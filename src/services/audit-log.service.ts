import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  parameters: any;
  result: "success" | "failure" | "pending";
  confirmationId?: string;
  userId?: string;
  ipAddress?: string;
  error?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly logDir: string;
  private readonly logFile: string;

  constructor() {
    // Store logs in user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
    this.logDir = path.join(homeDir, ".anki-mcp-server");
    this.logFile = path.join(this.logDir, "audit.log");

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    this.logger.log(`Audit log file: ${this.logFile}`);
  }

  /**
   * Log an action
   */
  async log(entry: Omit<AuditLogEntry, "timestamp">): Promise<void> {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    try {
      const logLine = JSON.stringify(logEntry) + "\n";
      fs.appendFileSync(this.logFile, logLine, "utf-8");
      this.logger.debug(`Audit log: ${entry.action} - ${entry.result}`);
    } catch (error) {
      this.logger.error("Failed to write audit log", error);
    }
  }

  /**
   * Log a destructive action that requires confirmation
   */
  async logDestructiveAction(
    action: string,
    parameters: any,
    confirmationId: string,
  ): Promise<void> {
    await this.log({
      action,
      parameters,
      result: "pending",
      confirmationId,
    });
  }

  /**
   * Log action completion
   */
  async logActionCompletion(
    action: string,
    parameters: any,
    result: "success" | "failure",
    error?: string,
  ): Promise<void> {
    await this.log({
      action,
      parameters,
      result,
      error,
    });
  }

  /**
   * Get recent audit logs
   */
  getRecentLogs(limit: number = 100): AuditLogEntry[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, "utf-8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      const recentLines = lines.slice(-limit);

      return recentLines.map((line) => JSON.parse(line));
    } catch (error) {
      this.logger.error("Failed to read audit logs", error);
      return [];
    }
  }

  /**
   * Clear audit logs
   */
  clearLogs(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, "", "utf-8");
        this.logger.log("Audit logs cleared");
      }
    } catch (error) {
      this.logger.error("Failed to clear audit logs", error);
    }
  }
}
