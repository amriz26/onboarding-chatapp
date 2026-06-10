import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText, type CoreMessage, type ToolSet } from "ai"
import { Context, Effect, Layer } from "effect"
import { AiApiError } from "@/lib/effect/errors"
import { ConfigService } from "./ConfigService"
import { SYSTEM_PROMPT } from "@/effects/chat"

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface AIServiceApi {
  /**
   * Run a streaming Claude conversation with a pre-built set of tools.
   *
   * Returns the Vercel AI SDK's StreamTextResult which the API route converts
   * to a Server-Sent Events response via .toDataStreamResponse(). That format
   * is what the client-side useChat hook consumes.
   *
   * Tools are passed in rather than fetched here — MCPService and the tool-
   * conversion logic live in ChatService, keeping AIService focused on the
   * single responsibility of talking to the AI provider.
   */
  readonly streamChat: (
    messages: CoreMessage[],
    tools: ToolSet,
  ) => Effect.Effect<ReturnType<typeof streamText>, AiApiError>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/**
 * AIService is the Effect tag for all AI provider interactions.
 * Callers depend on AIService, not on Anthropic or the Vercel AI SDK directly.
 * Swapping providers means only AIServiceLive changes — no call-site edits.
 */
export class AIService extends Context.Tag("AIService")<
  AIService,
  AIServiceApi
>() {}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

/**
 * AIServiceLive wraps the Vercel AI SDK's streamText in Effect.
 *
 * Design decisions:
 *   - The Anthropic API key is sourced from ConfigService (DI), not process.env.
 *   - createAnthropic() is called once at Layer construction time, not per
 *     request — the provider client is shared across all requests in the scope.
 *   - Effect.try wraps the synchronous streamText() call so that any setup
 *     errors (auth, rate limit) surface as typed AiApiError in the Effect
 *     error channel rather than as thrown exceptions.
 *
 * Why Vercel AI SDK for streaming?
 *   The useChat client hook on the browser consumes Server-Sent Events in the
 *   specific format produced by streamText().toDataStreamResponse(). That
 *   format includes structured tool-call events that drive the UI's tool
 *   invocation display. @effect/ai-anthropic (used in AILayer for non-
 *   streaming operations) returns Effect Streams, which would require a custom
 *   SSE bridge to reproduce that same format. The SSE format is the API
 *   contract with useChat; changing it would break the client.
 */
export const AIServiceLive: Layer.Layer<AIService, never, ConfigService> =
  Layer.effect(
    AIService,
    Effect.gen(function* () {
      const { anthropicApiKey } = yield* ConfigService

      // Construct the provider once — keys are resolved at layer build time.
      const anthropicProvider = createAnthropic({ apiKey: anthropicApiKey })

      return {
        streamChat: (messages: CoreMessage[], tools: ToolSet) =>
          Effect.try({
            try: () =>
              streamText({
                model: anthropicProvider("claude-3-5-sonnet-20241022"),
                system: SYSTEM_PROMPT,
                messages,
                tools,
                // Allow the model to chain multiple tool calls per response.
                maxSteps: 5,
                temperature: 0.7,
              }),
            catch: (cause) =>
              new AiApiError({
                message: `AI streamText call failed: ${String(cause)}`,
                cause,
              }),
          }),
      } satisfies AIServiceApi
    }),
  )
