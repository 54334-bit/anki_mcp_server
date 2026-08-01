import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  createPinoLogger,
  createLoggerService,
  LOG_DESTINATION,
} from "./bootstrap";
import { OriginValidationGuard } from "./http/guards/origin-validation.guard";
import { ApiKeyGuard } from "./http/guards/api-key.guard";
import { RateLimitGuard } from "./http/guards/rate-limit.guard";
import {
  parseCliArgs,
  parseOptionalUrl,
  displayStartupBanner,
  checkForUpdates,
} from "./cli";
import { createCli } from "@/cli";
import { NgrokService } from "./services/ngrok.service";
import { buildConfigInput } from "./config";

async function bootstrap() {
  // Check for updates (non-blocking, cached)
  checkForUpdates();

  const options = parseCliArgs();

  // Build the CLI output surface once with the parsed debug flag.
  // From here on, anything that needs user-facing output must receive `cli`
  // explicitly — there is no module-level fallback.
  const cli = createCli(options.debug);

  // Validate `--tunnel` URL at the parse boundary so an empty/garbage value
  // doesn't silently fall through `buildConfigInput` and either be ignored
  // (true/false) or fail Zod validation (empty string).
  const tunnelUrl = parseOptionalUrl(options.tunnel, "--tunnel", cli);

  // Build config input from env + CLI overrides (no process.env mutation)
  const configInput = buildConfigInput({
    port: options.port,
    host: options.host,
    ankiConnect: options.ankiConnect,
    readOnly: options.readOnly,
    tunnel: tunnelUrl,
    ngrok: options.ngrok,
    debug: options.debug,
  });

  // Create logger that writes to stdout for HTTP mode
  // Log level comes from configInput (set by --debug flag or LOG_LEVEL env)
  const pinoLogger = createPinoLogger(
    LOG_DESTINATION.STDOUT,
    configInput.LOG_LEVEL || "info",
  );
  const loggerService = createLoggerService(pinoLogger);

  // HTTP mode - create NestJS HTTP application
  const app = await NestFactory.create(AppModule.forHttp(configInput), {
    logger: loggerService,
    bufferLogs: true,
  });

  // Apply security guards (required by MCP Streamable HTTP spec)
  app.useGlobalGuards(new OriginValidationGuard());

  // Apply API Key authentication guard if API_KEY is configured
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    app.useGlobalGuards(app.get(ApiKeyGuard));
    cli.info("API Key authentication enabled");
  } else {
    cli.warn("API_KEY not set - HTTP server running without authentication");
    cli.warn("Set API_KEY environment variable to enable authentication");
  }

  // Apply rate limiting guard
  app.useGlobalGuards(app.get(RateLimitGuard));
  const rateLimit = process.env.RATE_LIMIT_PER_MINUTE || "60";
  cli.info(`Rate limiting enabled: ${rateLimit} requests per minute`);

  await app.listen(options.port, options.host);

  // Start ngrok if requested
  let ngrokUrl: string | undefined;
  if (options.ngrok) {
    try {
      const ngrokService = new NgrokService();
      const tunnelInfo = await ngrokService.start(options.port);
      ngrokUrl = tunnelInfo.publicUrl;
    } catch (err) {
      cli.blank();
      cli.error(
        `Failed to start ngrok: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
      );
      cli.blank();
      cli.info("Server is still running locally without tunnel.");
      cli.blank();
    }
  }

  // Show startup information
  displayStartupBanner(cli, options, ngrokUrl);
}

// Bootstrap-level error handler: we don't yet have a `cli` (options weren't
// parsed), so we build a non-debug one for the failure path.
bootstrap().catch((err) => {
  const cli = createCli(false);
  cli.error(
    `Failed to start MCP HTTP server: ${err instanceof Error ? err.message : String(err)}`,
    err instanceof Error ? err : undefined,
  );
  process.exit(1);
});
