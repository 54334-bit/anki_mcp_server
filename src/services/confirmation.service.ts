import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface PendingAction {
  id: string;
  action: string;
  parameters: any;
  createdAt: Date;
  expiresAt: Date;
  confirmed: boolean;
}

@Injectable()
export class ConfirmationService {
  private readonly logger = new Logger(ConfirmationService.name);
  private readonly pendingActions = new Map<string, PendingAction>();
  private readonly confirmationTimeoutMs = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Clean up expired actions every minute
    setInterval(() => this.cleanupExpired(), 60 * 1000);
  }

  /**
   * Create a pending action that requires confirmation
   */
  createPendingAction(action: string, parameters: any): string {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.confirmationTimeoutMs);

    const pendingAction: PendingAction = {
      id,
      action,
      parameters,
      createdAt: now,
      expiresAt,
      confirmed: false,
    };

    this.pendingActions.set(id, pendingAction);
    this.logger.log(`Created pending action ${id} for ${action}`);

    return id;
  }

  /**
   * Confirm a pending action
   */
  confirmAction(actionId: string): boolean {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      this.logger.warn(`Action ${actionId} not found`);
      return false;
    }

    if (new Date() > action.expiresAt) {
      this.logger.warn(`Action ${actionId} has expired`);
      this.pendingActions.delete(actionId);
      return false;
    }

    action.confirmed = true;
    this.logger.log(`Action ${actionId} confirmed`);
    return true;
  }

  /**
   * Check if an action is confirmed
   */
  isConfirmed(actionId: string): boolean {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      return false;
    }

    if (new Date() > action.expiresAt) {
      this.pendingActions.delete(actionId);
      return false;
    }

    return action.confirmed;
  }

  /**
   * Get pending action details
   */
  getPendingAction(actionId: string): PendingAction | null {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      return null;
    }

    if (new Date() > action.expiresAt) {
      this.pendingActions.delete(actionId);
      return null;
    }

    return action;
  }

  /**
   * Remove a pending action (after execution or cancellation)
   */
  removeAction(actionId: string): void {
    this.pendingActions.delete(actionId);
    this.logger.log(`Removed action ${actionId}`);
  }

  /**
   * Clean up expired actions
   */
  private cleanupExpired(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [id, action] of this.pendingActions.entries()) {
      if (now > action.expiresAt) {
        this.pendingActions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired actions`);
    }
  }
}
