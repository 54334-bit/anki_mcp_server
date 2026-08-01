import { Injectable, Logger } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { ConfirmationService } from '@/services/confirmation.service';
import { AuditLogService } from '@/services/audit-log.service';

@Injectable()
export class ConfirmActionTool {
  private readonly logger = new Logger(ConfirmActionTool.name);

  constructor(
    private readonly confirmationService: ConfirmationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Tool({
    name: 'confirmAction',
    description:
      'Confirm a pending destructive action. Use this after reviewing the action details from a previous tool call that required confirmation.',
    parameters: z.object({
      confirmationId: z
        .string()
        .describe('The confirmation ID returned by the destructive action tool'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      action: z.string().optional(),
      parameters: z.any().optional(),
    }),
    annotations: {
      title: 'Confirm Action',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async confirmAction({ confirmationId }: { confirmationId: string }) {
    try {
      this.logger.log(`Confirming action: ${confirmationId}`);

      const pendingAction = this.confirmationService.getPendingAction(confirmationId);

      if (!pendingAction) {
        return {
          success: false,
          message: 'Action not found or expired',
        };
      }

      if (pendingAction.confirmed) {
        return {
          success: false,
          message: 'Action already confirmed',
        };
      }

      const confirmed = this.confirmationService.confirmAction(confirmationId);

      if (confirmed) {
        await this.auditLogService.log({
          action: 'confirmAction',
          parameters: { confirmationId, originalAction: pendingAction.action },
          result: 'success',
        });

        return {
          success: true,
          message: 'Action confirmed. You can now execute the original operation.',
          action: pendingAction.action,
          parameters: pendingAction.parameters,
        };
      } else {
        return {
          success: false,
          message: 'Failed to confirm action',
        };
      }
    } catch (error) {
      this.logger.error('Failed to confirm action', error);
      await this.auditLogService.log({
        action: 'confirmAction',
        parameters: { confirmationId },
        result: 'failure',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
