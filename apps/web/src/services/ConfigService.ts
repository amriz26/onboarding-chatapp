import { Config, Context, Effect, Layer, Option } from "effect"
import { ConfigError as DomainConfigError } from "@/lib/effect/errors"

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface ConfigServiceApi {
  /** Path to the compiled Rust MCP binary. None when not configured (uses mock). */
  readonly mcpServerPath: Option.Option<string>
  /** URL of a remote HTTP MCP server. Takes priority over mcpServerPath when set. */
  readonly mcpServerUrl: Option.Option<string>
  /** Anthropic API key used to authenticate with Claude. */
  readonly anthropicApiKey: string
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/**
 * ConfigService centralises all environment-variable access behind a typed
 * service interface. No service reads process.env directly — they receive
 * configuration through dependency injection at the Layer level.
 *
 * Benefits:
 *   - Tests override ConfigService without touching process.env.
 *   - Missing required variables fail at startup (in the Layer), not at
 *     the first call site that needs the value.
 *   - Secrets are kept in a single, auditable location.
 */
export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  ConfigServiceApi
>() {}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

/**
 * ConfigLive reads from environment variables using Effect's Config module.
 *
 * We intentionally alias Effect's Config.ConfigError to DomainConfigError so
 * the error type in this layer stays within our own domain hierarchy (the two
 * are otherwise named identically, which causes TS to reject the annotation).
 *
 * Config.option wraps an optional variable — returns Option.none when absent.
 * Config.string fails when a required variable is missing; we map that to our
 * DomainConfigError so callers see one consistent error type.
 */
export const ConfigLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    // Optional — absence means use the MCP mock layer.
    const mcpServerPath = yield* Config.string("MCP_SERVER_PATH").pipe(
      Effect.map(Option.some<string>),
      Effect.orElseSucceed(() => Option.none<string>()),
    )

    // Optional — when set, the HTTP MCP client is used instead of stdio/mock.
    const mcpServerUrl = yield* Config.string("MCP_SERVER_URL").pipe(
      Effect.map(Option.some<string>),
      Effect.orElseSucceed(() => Option.none<string>()),
    )

    // Required — the application cannot function without an Anthropic key.
    const anthropicApiKey = yield* Config.string("ANTHROPIC_API_KEY").pipe(
      Effect.mapError(
        () =>
          new DomainConfigError({
            key: "ANTHROPIC_API_KEY",
            message:
              "ANTHROPIC_API_KEY environment variable is required but not set",
          }),
      ),
    )

    return { mcpServerPath, mcpServerUrl, anthropicApiKey } satisfies ConfigServiceApi
  }),
)
