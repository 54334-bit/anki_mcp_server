import { Injectable, Logger } from "@nestjs/common";
import { Tool } from "@rekog/mcp-nest";
import { z } from "zod";
import { AnkiConnectClient } from "@/mcp/clients/anki-connect.client";
import { createErrorResponse } from "@/mcp/utils/anki.utils";
import { deleteMediaFile } from "./mediaActions/actions/deleteMediaFile.action";
import { ConfirmationService } from "@/services/confirmation.service";
import { AuditLogService } from "@/services/audit-log.service";

@Injectable()
export class DeleteMediaFileTool {
  private readonly logger = new Logger(DeleteMediaFileTool.name);

  constructor(
    private readonly ankiClient: AnkiConnectClient,
    private readonly confirmationService: ConfirmationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Tool({
    name: "deleteMediaFile",
    description:
      "Remove a media file from Anki's collection.media folder. CRITICAL: This is destructive and permanent - only delete media the user explicitly confirmed for deletion. " +
      "SECURITY: This operation requires a two-step confirmation process. " +
      "First call will return a confirmationId. You must then call confirmAction with that ID, " +
      "and finally call deleteMediaFile again with confirmationId to execute the deletion.",
    parameters: z.object({
      filename: z
        .string()
        .describe(
          'Filename of the media file to delete (e.g., "old_audio.mp3")',
        ),
      confirmationId: z
        .string()
        .optional()
        .describe(
          "The confirmation ID from a previous call to deleteMediaFile. " +
            "Required to execute the deletion. If not provided, a new confirmation will be created.",
        ),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      filename: z.string(),
      message: z.string(),
      confirmationId: z.string().optional(),
      pendingAction: z.boolean().optional(),
      hint: z.string().optional(),
      warning: z.string().optional(),
    }),
    annotations: {
      title: "Delete Media File",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
  })
  async execute(params: { filename: string; confirmationId?: string }) {
    try {
      // Step 1: If no confirmationId provided, create pending action
      if (!params.confirmationId) {
        this.logger.log(
          `Creating pending deletion for media file: ${params.filename}`,
        );

        const pendingId = this.confirmationService.createPendingAction(
          "deleteMediaFile",
          { filename: params.filename },
        );

        await this.auditLogService.logDestructiveAction(
          "deleteMediaFile",
          { filename: params.filename },
          pendingId,
        );

        return {
          success: false,
          filename: params.filename,
          message: `Deletion requires confirmation. Media file "${params.filename}" pending deletion.`,
          confirmationId: pendingId,
          pendingAction: true,
          hint: `Call confirmAction with confirmationId="${pendingId}", then call deleteMediaFile again with the same confirmationId`,
          warning:
            "This action will permanently delete the media file from Anki's collection",
        };
      }

      // Step 2: Check if action is confirmed
      if (!this.confirmationService.isConfirmed(params.confirmationId)) {
        return {
          success: false,
          filename: params.filename,
          message: "Action not confirmed or expired",
          confirmationId: params.confirmationId,
          pendingAction: false,
          hint: `Call confirmAction with confirmationId="${params.confirmationId}" first`,
        };
      }

      // Step 3: Execute deletion
      this.logger.log(`Executing deleteMediaFile: ${params.filename}`);

      const result = await deleteMediaFile(
        { filename: params.filename },
        this.ankiClient,
      );

      await this.auditLogService.logActionCompletion(
        "deleteMediaFile",
        { filename: params.filename },
        "success",
      );

      this.confirmationService.removeAction(params.confirmationId);

      return {
        ...result,
        confirmationId: params.confirmationId,
        pendingAction: false,
        warning: "This media file has been permanently deleted",
      };
    } catch (error) {
      this.logger.error("Failed to execute deleteMediaFile", error);

      await this.auditLogService.logActionCompletion(
        "deleteMediaFile",
        { filename: params.filename },
        "failure",
        error instanceof Error ? error.message : String(error),
      );

      return createErrorResponse(error, {
        action: "deleteMediaFile",
        hint: "Make sure Anki is running and the filename is valid",
      });
    }
  }
}
