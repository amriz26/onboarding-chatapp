/**
 * Application-level error types.
 *
 * WHY TYPED ERRORS IN EFFECT?
 * In traditional TypeScript you throw plain Error objects and catch them with
 * try/catch. The problem: TypeScript has no way to track which errors a
 * function can produce. You don't know at the call site whether to expect a
 * network error, a validation error, or something else.
 *
 * Effect's error channel solves this. Every Effect has the type:
 *   Effect<SuccessValue, ErrorType, RequiredServices>
 *
 * The ErrorType is tracked statically. Callers MUST handle (or re-raise) each
 * error type. This turns "what can go wrong?" from a documentation problem
 * into a compile-time guarantee.
 *
 * Using Data.TaggedError gives us:
 *   - A discriminant tag for pattern matching
 *   - Structural equality (useful in tests)
 *   - A clean constructor
 */

import { Data } from "effect"

// ---------------------------------------------------------------------------
// MCP errors
// ---------------------------------------------------------------------------

/** Failed to start or connect to the Rust MCP server process. */
export class McpConnectionError extends Data.TaggedError("McpConnectionError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** The MCP server returned an error when calling a tool. */
export class McpToolCallError extends Data.TaggedError("McpToolCallError")<{
  readonly toolName: string
  readonly message: string
  readonly cause?: unknown
}> {}

/** The list of tools returned by the MCP server is empty or malformed. */
export class McpToolDiscoveryError extends Data.TaggedError("McpToolDiscoveryError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

/** Incoming request failed Effect Schema validation. */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
  readonly field?: string
}> {}

// ---------------------------------------------------------------------------
// AI errors
// ---------------------------------------------------------------------------

/** The AI API call failed (network, rate limit, auth, etc.). */
export class AiApiError extends Data.TaggedError("AiApiError")<{
  readonly message: string
  readonly statusCode?: number
  readonly cause?: unknown
}> {}

/** The AI response was empty or could not be parsed. */
export class AiResponseError extends Data.TaggedError("AiResponseError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

// ---------------------------------------------------------------------------
// Configuration errors
// ---------------------------------------------------------------------------

/** A required environment variable is missing or invalid. */
export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly key: string
  readonly message: string
}> {}
