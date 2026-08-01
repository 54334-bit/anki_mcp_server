import { Injectable, Logger } from "@nestjs/common";

export interface IdempotencyEntry {
  idempotencyKey: string;
  action: string;
  params: any;
  result: any;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly store = new Map<string, IdempotencyEntry>();
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Clean up expired entries every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Check if an operation has already been executed
   */
  get(idempotencyKey: string, action: string): IdempotencyEntry | null {
    const entry = this.store.get(idempotencyKey);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.store.delete(idempotencyKey);
      return null;
    }

    // Check if action matches (prevent key reuse for different actions)
    if (entry.action !== action) {
      this.logger.warn(
        `Idempotency key ${idempotencyKey} reused for different action. ` +
          `Expected: ${entry.action}, Got: ${action}`,
      );
      return null;
    }

    this.logger.debug(`Idempotency hit: ${idempotencyKey} for ${action}`);
    return entry;
  }

  /**
   * Store the result of an operation
   */
  set(idempotencyKey: string, action: string, params: any, result: any): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);

    const entry: IdempotencyEntry = {
      idempotencyKey,
      action,
      params,
      result,
      createdAt: now,
      expiresAt,
    };

    this.store.set(idempotencyKey, entry);
    this.logger.debug(
      `Stored idempotency entry: ${idempotencyKey} for ${action}`,
    );
  }

  /**
   * Remove an idempotency entry
   */
  remove(idempotencyKey: string): void {
    this.store.delete(idempotencyKey);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired idempotency entries`);
    }
  }
}
