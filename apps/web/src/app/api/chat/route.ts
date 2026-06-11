/**
 * POST /api/chat — streaming chat endpoint.
 *
 * Architecture:
 *   Browser → POST /api/chat (JSON body)
 *     → validate with Effect Schema
 *       → streamChatProgram (ChatService → MCPService + AIService)
 *         → toDataStreamResponse() → SSE → browser useChat hook
 *
 * The entire request lifecycle (validation + service execution) is a single
 * Effect program. Typed failures map to deterministic HTTP status codes:
 *
 *   McpConnectionError   → 503  (MCP server not reachable)
 *   McpToolDiscoveryError → 502  (tool list call failed)
 *   AiApiError           → 502  (Anthropic API failure)
 *   ValidationError      → 400  (malformed request body)
 *   ConfigError          → 500  (missing env var)
 *   Other               → 500  (unexpected)
 *
 * Effect.scoped ensures the MCP connection (a scoped resource in MCPLayer) is
 * acquired and released within this single request, regardless of success or
 * failure.
 */

import { Cause, Effect, Option, Schema } from "effect"
import { type CoreMessage } from "ai"
import { AppLayer } from "@/layers/ChatLayer"
import { ChatRequestSchema } from "@/lib/schemas"
import { ValidationError } from "@/lib/effect/errors"
import { streamChatProgram } from "@/effects/chat"

// Node.js runtime required — MCP SDK spawns child processes unavailable in Edge.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request): Promise<Response> {
  // ---------------------------------------------------------------------------
  // Parse: raw JSON deserialization lives at the I/O boundary where try/catch
  // is appropriate. Body parsing is not modelled as an Effect because it is a
  // pure I/O operation with no typed failure modes we can act on differently.
  // ---------------------------------------------------------------------------
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return jsonError("Invalid JSON body", 400)
  }

  // ---------------------------------------------------------------------------
  // Single Effect pipeline: validate → stream.
  //
  // Effect.gen threads validation and service execution through a typed error
  // channel. Every possible failure is visible in the type signature; the match
  // below is exhaustive by construction.
  // ---------------------------------------------------------------------------
  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      // Schema validation — ParseError maps to our domain ValidationError.
      const { messages } = yield* Schema.decodeUnknown(ChatRequestSchema)(
        rawBody,
      ).pipe(
        Effect.mapError(
          (parseError) =>
            new ValidationError({
              message: `Invalid request body: ${parseError.message}`,
            }),
        ),
      )

      // Delegate to the pure Effect program — ChatService is resolved from AppLayer.
      // Schema gives readonly tuples; CoreMessage[] is mutable — cast via unknown.
      return yield* streamChatProgram(messages as unknown as CoreMessage[])
    }).pipe(
      Effect.provide(AppLayer),
      // scoped: acquire MCP connection for this request, release on completion.
      Effect.scoped,
    ),
  )

  // ---------------------------------------------------------------------------
  // Map typed failures → HTTP responses (exhaustive by Effect's error channel).
  // ---------------------------------------------------------------------------
  if (exit._tag === "Failure") {
    const { cause } = exit

    // Cause.failureOption handles Fail, Sequential, and Parallel cause shapes —
    // cause._tag may be "Sequential" or "Parallel" when layers fail together,
    // so checking cause._tag === "Fail" directly misses those cases.
    const failureOption = Cause.failureOption(cause)

    if (Option.isSome(failureOption)) {
      const error = failureOption.value as { _tag?: string; message?: string }
      const tag = error?._tag

      if (tag === "McpConnectionError")
        return jsonError(`MCP server unavailable: ${error.message}`, 503)
      if (tag === "McpToolDiscoveryError")
        return jsonError(`Failed to discover MCP tools: ${error.message}`, 502)
      if (tag === "AiApiError")
        return jsonError(`AI API error: ${error.message}`, 502)
      if (tag === "ValidationError")
        return jsonError(error.message ?? "Validation error", 400)
      if (tag === "ConfigError")
        return jsonError(`Server configuration error: ${error.message}`, 500)

      console.error("[/api/chat] Unhandled typed failure:", JSON.stringify(error))
      return jsonError(`Error [${tag ?? "unknown"}]: ${error.message ?? "no message"}`, 500)
    } else {
      // Die or Interrupt — an unhandled throw or fiber interruption
      const defect = Cause.isDie(cause) ? String(Cause.dieOption(cause).pipe(Option.getOrElse(() => "unknown"))) : "interrupt"
      console.error("[/api/chat] Defect/interrupt:", defect, JSON.stringify(cause))
      return jsonError(`Server defect: ${defect}`, 500)
    }
  }

  // ---------------------------------------------------------------------------
  // Stream: toDataStreamResponse() encodes the result as SSE in the format
  // that useChat (and AI SDK Elements) expects.
  // ---------------------------------------------------------------------------
  return exit.value.toDataStreamResponse({
    getErrorMessage: (error) => {
      console.error("[/api/chat] streaming error:", error)
      return error instanceof Error ? error.message : String(error)
    },
  })
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
