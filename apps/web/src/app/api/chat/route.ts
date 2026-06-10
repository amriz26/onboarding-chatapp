/**
 * POST /api/chat — streaming chat endpoint.
 *
 * FLOW:
 *   Browser → POST /api/chat (JSON body) → this route
 *     → Effect program (parse + validate + fetch MCP tools)
 *       → streamText (Anthropic Claude + MCP tool executors)
 *         → ReadableStream → Browser (Server-Sent Events)
 *
 * WHY EFFECT FOR THE SETUP (not just async/await)?
 *   The setup phase has multiple typed failure modes:
 *     - McpConnectionError   → 503
 *     - McpToolDiscoveryError → 502
 *     - ValidationError      → 400
 *     - AiApiError           → 502
 *
 *   Effect tracks all of these in the type system. The match at the end of
 *   this file is exhaustive — the compiler forces us to handle every case.
 *   No forgotten error paths, no silent swallowing.
 *
 * WHY Effect.scoped + Layer.toRuntime?
 *   McpClientLive uses Layer.scoped, which means it creates resources
 *   (the MCP process) that must be cleaned up. Effect.scoped creates a
 *   Scope and runs the finalizers (close the MCP pipe) when the Effect
 *   completes — regardless of success or failure.
 */

import { Effect, Layer } from "effect"
import { Schema } from "effect"
import { type CoreMessage } from "ai"
import { ChatService } from "@/lib/effect/services/chat-service"
import { ChatLayer } from "@/lib/effect/layers"
import { ChatRequestSchema } from "@/lib/schemas"
import {
  McpConnectionError,
  McpToolDiscoveryError,
  ValidationError,
  AiApiError,
} from "@/lib/effect/errors"

// Force Node.js runtime — the MCP SDK spawns child processes which are not
// available in the Edge runtime.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request): Promise<Response> {
  // ---------------------------------------------------------------------------
  // Step 1: Parse the request body (outside Effect — raw JSON parsing can't
  //         be modelled as an Effect because it's synchronous and infallible
  //         at the HTTP level).
  // ---------------------------------------------------------------------------
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return jsonError("Invalid JSON body", 400)
  }

  // ---------------------------------------------------------------------------
  // Step 2: Validate the body with Effect Schema.
  //
  // Schema.decodeUnknown returns an Effect<ChatRequest, ParseError>.
  // We map the ParseError to our domain ValidationError type.
  // ---------------------------------------------------------------------------
  const parseResult = await Effect.runPromiseExit(
    Schema.decodeUnknown(ChatRequestSchema)(rawBody).pipe(
      Effect.mapError(
        (parseError) =>
          new ValidationError({
            message: `Invalid request body: ${parseError.message}`,
          }),
      ),
    ),
  )

  if (parseResult._tag === "Failure") {
    const cause = parseResult.cause
    const msg =
      cause._tag === "Fail" ? (cause.error as ValidationError).message : "Validation failed"
    return jsonError(msg, 400)
  }

  const { messages } = parseResult.value

  // ---------------------------------------------------------------------------
  // Step 3: Run the chat service inside a scoped Effect.
  //
  // Effect.scoped creates a Scope for the request.
  // Layer.toRuntime(ChatLayer) builds the Layer graph within that Scope.
  // When the scope closes (after the Effect finishes), all finalizers run —
  // including the MCP process cleanup.
  // ---------------------------------------------------------------------------
  const chatProgram = Effect.gen(function* () {
    const chatService = yield* ChatService
    return yield* chatService.streamChat(messages as CoreMessage[])
  })

  const exit = await Effect.runPromiseExit(
    chatProgram.pipe(
      Effect.provide(ChatLayer),
      // scoped ensures the Layer's resources (MCP connection) are acquired and
      // released within this single request's lifecycle.
      Effect.scoped,
    ),
  )

  // ---------------------------------------------------------------------------
  // Step 4: Map typed failures to HTTP responses.
  // ---------------------------------------------------------------------------
  if (exit._tag === "Failure") {
    const cause = exit.cause

    if (cause._tag === "Fail") {
      const error = cause.error

      if (error instanceof McpConnectionError) {
        return jsonError(
          `MCP server unavailable: ${error.message}. ` +
            `Run \`pnpm build:mcp\` and set MCP_SERVER_PATH.`,
          503,
        )
      }

      if (error instanceof McpToolDiscoveryError) {
        return jsonError(`Failed to discover MCP tools: ${error.message}`, 502)
      }

      if (error instanceof AiApiError) {
        return jsonError(`AI API error: ${error.message}`, 502)
      }

      if (error instanceof ValidationError) {
        return jsonError(error.message, 400)
      }
    }

    console.error("[/api/chat] Unexpected failure:", cause)
    return jsonError("Internal server error", 500)
  }

  // ---------------------------------------------------------------------------
  // Step 5: Return the AI SDK streaming response.
  //
  // toDataStreamResponse() encodes the stream as Server-Sent Events in the
  // format the useChat() client hook expects.
  // ---------------------------------------------------------------------------
  return exit.value.toDataStreamResponse()
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
