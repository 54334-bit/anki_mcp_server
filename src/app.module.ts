import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { McpModule, McpTransportType } from "@rekog/mcp-nest";
import {
  McpPrimitivesAnkiEssentialModule,
  ANKI_CONFIG,
  ESSENTIAL_MCP_TOOLS,
} from "./mcp/primitives/essential";
import {
  McpPrimitivesAnkiGuiModule,
  GUI_MCP_TOOLS,
} from "./mcp/primitives/gui";
import { AppConfigService } from "./app-config.service";
import {
  configSchema,
  transformEnvToConfig,
  ConfigInput,
  APP_CONFIG,
  loadValidatedConfig,
  CliOverrides,
} from "@/config";
import { MCP_ICONS } from "./mcp/mcp-icons";
import { TunnelMcpService } from "./tunnel/tunnel-mcp.service";
import { ConfirmationService } from "./services/confirmation.service";
import { AuditLogService } from "./services/audit-log.service";
import { IdempotencyService } from "./services/idempotency.service";
import { ConfirmActionTool } from "./mcp/primitives/essential/tools/confirm-action.tool";
import { ApiKeyGuard } from "./http/guards/api-key.guard";
import { RateLimitGuard } from "./http/guards/rate-limit.guard";

@Module({})
export class AppModule {
  /**
   * Creates AppModule configured for STDIO transport
   * @param configInput - Raw config input (merged env + CLI overrides)
   */
  static forStdio(configInput: ConfigInput): DynamicModule {
    // Parse config once, use everywhere (single source of truth)
    const validatedConfig = configSchema.parse(
      transformEnvToConfig(configInput),
    );

    return {
      module: AppModule,
      imports: [
        // Configuration Module (uses same validated config)
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          load: [() => validatedConfig],
        }),

        // MCP Module with STDIO transport
        McpModule.forRoot({
          name: process.env.MCP_SERVER_NAME || "anki-mcp-server",
          version: process.env.MCP_SERVER_VERSION || "1.0.0",
          transport: McpTransportType.STDIO,
          icons: MCP_ICONS,
        }),

        // Import MCP primitives with config
        McpPrimitivesAnkiEssentialModule.forRoot({
          ankiConfigValue: {
            ankiConnectUrl: validatedConfig.ankiConnect.url,
            ankiConnectApiKey: validatedConfig.ankiConnect.apiKey,
            ankiConnectApiVersion: validatedConfig.ankiConnect.apiVersion,
            ankiConnectTimeout: validatedConfig.ankiConnect.timeout,
            readOnly: validatedConfig.readOnly,
          },
          appConfigProvider: {
            provide: APP_CONFIG,
            useValue: validatedConfig,
          },
        }),

        // Import GUI primitives with config
        McpPrimitivesAnkiGuiModule.forRoot({
          ankiConfigValue: {
            ankiConnectUrl: validatedConfig.ankiConnect.url,
            ankiConnectApiKey: validatedConfig.ankiConnect.apiKey,
            ankiConnectApiVersion: validatedConfig.ankiConnect.apiVersion,
            ankiConnectTimeout: validatedConfig.ankiConnect.timeout,
            readOnly: validatedConfig.readOnly,
          },
          appConfigProvider: {
            provide: APP_CONFIG,
            useValue: validatedConfig,
          },
        }),
      ],
      // MCP-Nest 1.9.0+ requires tools to be explicitly listed in the module where McpModule.forRoot() is configured.
      providers: [
        {
          provide: APP_CONFIG,
          useValue: validatedConfig,
        },
        AppConfigService,
        ConfirmationService,
        AuditLogService,
        IdempotencyService,
        ConfirmActionTool,
        ...ESSENTIAL_MCP_TOOLS,
        ...GUI_MCP_TOOLS,
      ],
      exports: [APP_CONFIG, AppConfigService, ConfirmationService, AuditLogService, IdempotencyService],
    };
  }

  /**
   * Creates AppModule configured for HTTP (Streamable HTTP) transport
   * @param configInput - Raw config input (merged env + CLI overrides)
   */
  static forHttp(configInput: ConfigInput): DynamicModule {
    // Parse config once, use everywhere (single source of truth)
    const validatedConfig = configSchema.parse(
      transformEnvToConfig(configInput),
    );

    return {
      module: AppModule,
      imports: [
        // Configuration Module (uses same validated config)
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          load: [() => validatedConfig],
        }),

        // MCP Module with Streamable HTTP transport
        McpModule.forRoot({
          name: process.env.MCP_SERVER_NAME || "anki-mcp-server",
          version: process.env.MCP_SERVER_VERSION || "1.0.0",
          transport: McpTransportType.STREAMABLE_HTTP,
          mcpEndpoint: "/",
          icons: MCP_ICONS,
        }),

        // Import MCP primitives with config
        McpPrimitivesAnkiEssentialModule.forRoot({
          ankiConfigValue: {
            ankiConnectUrl: validatedConfig.ankiConnect.url,
            ankiConnectApiKey: validatedConfig.ankiConnect.apiKey,
            ankiConnectApiVersion: validatedConfig.ankiConnect.apiVersion,
            ankiConnectTimeout: validatedConfig.ankiConnect.timeout,
            readOnly: validatedConfig.readOnly,
          },
          appConfigProvider: {
            provide: APP_CONFIG,
            useValue: validatedConfig,
          },
        }),

        // Import GUI primitives with config
        McpPrimitivesAnkiGuiModule.forRoot({
          ankiConfigValue: {
            ankiConnectUrl: validatedConfig.ankiConnect.url,
            ankiConnectApiKey: validatedConfig.ankiConnect.apiKey,
            ankiConnectApiVersion: validatedConfig.ankiConnect.apiVersion,
            ankiConnectTimeout: validatedConfig.ankiConnect.timeout,
            readOnly: validatedConfig.readOnly,
          },
          appConfigProvider: {
            provide: APP_CONFIG,
            useValue: validatedConfig,
          },
        }),
      ],
      // MCP-Nest 1.9.0+ requires tools to be explicitly listed in the module where McpModule.forRoot() is configured.
      providers: [
        {
          provide: APP_CONFIG,
          useValue: validatedConfig,
        },
        AppConfigService,
        ConfirmationService,
        AuditLogService,
        IdempotencyService,
        ConfirmActionTool,
        ApiKeyGuard,
        RateLimitGuard,
        ...ESSENTIAL_MCP_TOOLS,
        ...GUI_MCP_TOOLS,
      ],
      exports: [APP_CONFIG, AppConfigService, ConfirmationService, AuditLogService, IdempotencyService],
    };
  }

  /**
   * Creates AppModule configured for Tunnel transport (in-memory MCP service)
   * @param cliOverrides - Optional CLI argument overrides
   */
  static forTunnel(cliOverrides?: CliOverrides): DynamicModule {
    // Use loadValidatedConfig to parse CLI overrides + env
    const validatedConfig = loadValidatedConfig(cliOverrides);

    return {
      module: AppModule,
      imports: [
        // Configuration Module (uses same validated config)
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          load: [() => validatedConfig],
        }),

        // MCP Module with NO transport (TunnelMcpService handles transport via InMemoryTransport)
        // Using empty array prevents StdioService from blocking stdin in watch mode
        McpModule.forRoot({
          name: process.env.MCP_SERVER_NAME || "anki-mcp-server",
          version: process.env.MCP_SERVER_VERSION || "1.0.0",
          transport: [],
          icons: MCP_ICONS,
        }),

        // Import MCP primitives with config
        McpPrimitivesAnkiEssentialModule.forRoot({
          ankiConfigProvider: {
            provide: ANKI_CONFIG,
            useClass: AppConfigService,
          },
          appConfigProvider: {
            provide: APP_CONFIG,
            useValue: validatedConfig,
          },
        }),

        // Import GUI primitives with config
        McpPrimitivesAnkiGuiModule.forRoot({
          ankiConfigProvider: {
            provide: ANKI_CONFIG,
            useClass: AppConfigService,
          },
          appConfigProvider: {
            provide: APP_CONFIG,
            useValue: validatedConfig,
          },
        }),
      ],
      providers: [
        // Provide validated config for type-safe injection
        {
          provide: APP_CONFIG,
          useValue: validatedConfig,
        },
        AppConfigService,
        // Custom tunnel MCP service (instead of StdioModule)
        TunnelMcpService,
        ConfirmationService,
        AuditLogService,
        IdempotencyService,
        ConfirmActionTool,
        // MCP-Nest requires tools in root module providers for discovery
        ...ESSENTIAL_MCP_TOOLS,
        ...GUI_MCP_TOOLS,
      ],
      exports: [APP_CONFIG, AppConfigService, TunnelMcpService, ConfirmationService, AuditLogService, IdempotencyService],
    };
  }
}
