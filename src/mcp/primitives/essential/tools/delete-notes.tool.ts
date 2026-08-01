import { Injectable, Logger } from "@nestjs/common";
import { Tool } from "@rekog/mcp-nest";
import { z } from "zod";
import { AnkiConnectClient } from "@/mcp/clients/anki-connect.client";
import { createErrorResponse } from "@/mcp/utils/anki.utils";
import { ConfirmationService } from "@/services/confirmation.service";
import { AuditLogService } from "@/services/audit-log.service";

/**
 * Tool for deleting notes and their associated cards
 */
@Injectable()
export class DeleteNotesTool {
  private readonly logger = new Logger(DeleteNotesTool.name);

  constructor(
    private readonly ankiClient: AnkiConnectClient,
    private readonly confirmationService: ConfirmationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Tool({
    name: "deleteNotes",
    description:
      "Delete notes by their IDs. This will permanently remove the notes and ALL associated cards. " +
      "This action cannot be undone unless you have a backup. " +
      "SECURITY: This operation requires a two-step confirmation process. " +
      "First call will return a confirmationId. You must then call confirmAction with that ID, " +
      "and finally call deleteNotes again with confirmationId to execute the deletion.",
    parameters: z.object({
      notes: z
        .array(z.number())
        .min(1)
        .max(100)
        .describe(
          "Array of note IDs to delete (max 100 at once for safety). " +
            "Get these IDs from findNotes tool. ALL cards associated with these notes will be deleted.",
        ),
      confirmationId: z
        .string()
        .optional()
        .describe(
          "The confirmation ID from a previous call to deleteNotes. " +
            "Required to execute the deletion. If not provided, a new confirmation will be created.",
        ),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      deletedCount: z.number().optional(),
      deletedNoteIds: z.array(z.number()).optional(),
      cardsDeleted: z.number().optional(),
      notFoundCount: z.number().optional(),
      requestedIds: z.array(z.number()),
      message: z.string(),
      warning: z.string().optional(),
      hint: z.string().optional(),
      confirmationId: z.string().optional(),
      pendingAction: z.boolean().optional(),
    }),
    annotations: {
      title: "Delete Notes",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
  })
  async deleteNotes({
    notes,
    confirmationId,
  }: {
    notes: number[];
    confirmationId?: string;
  }) {
    try {
      // Step 1: If no confirmationId provided, create pending action
      if (!confirmationId) {
        this.logger.log(
          `Creating pending deletion for ${notes.length} note(s)`,
        );

        const pendingId = this.confirmationService.createPendingAction(
          "deleteNotes",
          { notes },
        );

        await this.auditLogService.logDestructiveAction(
          "deleteNotes",
          { notes, noteCount: notes.length },
          pendingId,
        );

        return {
          success: false,
          requestedIds: notes,
          message: `Deletion requires confirmation. ${notes.length} note(s) pending deletion.`,
          confirmationId: pendingId,
          pendingAction: true,
          hint: `Call confirmAction with confirmationId="${pendingId}", then call deleteNotes again with the same confirmationId`,
          warning:
            "This action will permanently delete notes and all associated cards",
        };
      }

      // Step 2: Check if action is confirmed
      if (!this.confirmationService.isConfirmed(confirmationId)) {
        return {
          success: false,
          requestedIds: notes,
          message: "Action not confirmed or expired",
          confirmationId,
          pendingAction: false,
          hint: `Call confirmAction with confirmationId="${confirmationId}" first`,
        };
      }

      // Step 3: Execute deletion
      this.logger.log(`Executing deletion of ${notes.length} note(s)`);

      // First, get info about the notes to be deleted (for logging and confirmation)
      const notesInfo = await this.ankiClient.invoke<any[]>("notesInfo", {
        notes: notes,
      });

      const validNotes = notesInfo.filter((note) => note && note.noteId);
      const validNoteIds = validNotes.map((note) => note.noteId);
      const notFoundCount = notes.length - validNotes.length;

      if (validNoteIds.length === 0) {
        this.logger.warn("No valid notes found to delete");

        await this.auditLogService.logActionCompletion(
          "deleteNotes",
          { notes, noteCount: notes.length },
          "success",
        );

        this.confirmationService.removeAction(confirmationId);

        return {
          success: true,
          deletedCount: 0,
          notFoundCount: notes.length,
          requestedIds: notes,
          message:
            "No notes were deleted (none of the provided IDs were valid)",
          hint: "The notes may have already been deleted or the IDs are invalid",
        };
      }

      // Count total cards that will be deleted
      const totalCards = validNotes.reduce(
        (sum, note) => sum + (note.cards?.length || 0),
        0,
      );

      // Call AnkiConnect deleteNotes action
      await this.ankiClient.invoke<null>("deleteNotes", {
        notes: validNoteIds,
      });

      this.logger.log(
        `Successfully deleted ${validNoteIds.length} note(s) and ${totalCards} card(s)`,
      );

      await this.auditLogService.logActionCompletion(
        "deleteNotes",
        { notes, deletedCount: validNoteIds.length, cardsDeleted: totalCards },
        "success",
      );

      this.confirmationService.removeAction(confirmationId);

      const message =
        notFoundCount > 0
          ? `Successfully deleted ${validNoteIds.length} note(s) and ${totalCards} card(s). ${notFoundCount} note(s) were not found.`
          : `Successfully deleted ${validNoteIds.length} note(s) and ${totalCards} card(s)`;

      return {
        success: true,
        deletedCount: validNoteIds.length,
        deletedNoteIds: validNoteIds,
        cardsDeleted: totalCards,
        notFoundCount,
        requestedIds: notes,
        message: message,
        warning: "These notes and cards have been permanently deleted",
        hint: "Consider syncing with AnkiWeb to propagate deletions to other devices",
      };
    } catch (error) {
      this.logger.error("Failed to delete notes", error);

      await this.auditLogService.logActionCompletion(
        "deleteNotes",
        { notes },
        "failure",
        error instanceof Error ? error.message : String(error),
      );

      if (error instanceof Error) {
        if (error.message.includes("permission")) {
          return createErrorResponse(error, {
            requestedNotes: notes,
            hint: "Permission denied. Check if Anki allows deletions via AnkiConnect.",
          });
        }
      }

      return createErrorResponse(error, {
        requestedNotes: notes,
        hint: "Make sure Anki is running and the note IDs are valid",
      });
    }
  }
}
