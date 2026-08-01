import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("apiKey");
    if (this.apiKey) {
      this.logger.log("API Key authentication enabled");
    } else {
      this.logger.warn(
        "API Key not configured - requests will be unauthenticated",
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // If no API key is configured, allow all requests (backward compatibility)
    if (!this.apiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = this.extractApiKey(request);

    if (!providedKey) {
      this.logger.warn(`Missing API key from ${request.ip}`);
      throw new UnauthorizedException("API key is required");
    }

    if (providedKey !== this.apiKey) {
      this.logger.warn(`Invalid API key attempt from ${request.ip}`);
      throw new UnauthorizedException("Invalid API key");
    }

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    // Check Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    const apiKeyHeader = request.headers["x-api-key"];
    if (typeof apiKeyHeader === "string") {
      return apiKeyHeader;
    }

    // Check query parameter (less secure, but useful for testing)
    const apiKeyQuery = request.query["api_key"];
    if (typeof apiKeyQuery === "string") {
      return apiKeyQuery;
    }

    return undefined;
  }
}
