import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";

interface RateLimitEntry {
  timestamps: number[];
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly rateLimitPerMinute: number;
  private readonly clients = new Map<string, RateLimitEntry>();
  private readonly windowMs = 60 * 1000; // 1 minute

  constructor(private readonly configService: ConfigService) {
    this.rateLimitPerMinute =
      this.configService.get<number>("rateLimitPerMinute") || 60;
    this.logger.log(
      `Rate limiting enabled: ${this.rateLimitPerMinute} requests per minute`,
    );

    // Clean up expired entries every minute
    setInterval(() => this.cleanupExpired(), 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create rate limit entry for this client
    let entry = this.clients.get(clientIp);
    if (!entry) {
      entry = { timestamps: [] };
      this.clients.set(clientIp, entry);
    }

    // Remove timestamps outside the current window (sliding window)
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    // Check if rate limit exceeded
    if (entry.timestamps.length >= this.rateLimitPerMinute) {
      this.logger.warn(
        `Rate limit exceeded for ${clientIp}: ${entry.timestamps.length}/${this.rateLimitPerMinute} requests`,
      );
      throw new HttpException(
        {
          success: false,
          message: `Rate limit exceeded. Maximum ${this.rateLimitPerMinute} requests per minute.`,
          retryAfter: Math.ceil(
            (entry.timestamps[0] + this.windowMs - now) / 1000,
          ),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add current timestamp
    entry.timestamps.push(now);

    return true;
  }

  private getClientIp(request: Request): string {
    // Check X-Forwarded-For header (for proxied requests)
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }

    // Fall back to request IP
    return request.ip || "unknown";
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let cleaned = 0;

    for (const [ip, entry] of this.clients.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
      if (entry.timestamps.length === 0) {
        this.clients.delete(ip);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }
}
