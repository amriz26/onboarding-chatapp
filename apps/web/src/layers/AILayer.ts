import { Layer } from "effect"
import { AIServiceLive } from "@/services/AIService"
import { ConfigLive } from "@/services/ConfigService"

// ---------------------------------------------------------------------------
// Streaming AI layer (primary — used by ChatService for SSE streaming)
// ---------------------------------------------------------------------------

/**
 * AILayer — provides AIService to the application.
 *
 * AIService wraps streamText from the Vercel AI SDK so the SSE format that
 * useChat consumes (text deltas, tool-call events, finish events) works
 * correctly. The Anthropic API key flows through ConfigService — no service
 * reads process.env directly.
 */
export const AILayer = AIServiceLive.pipe(Layer.provide(ConfigLive))

// ---------------------------------------------------------------------------
// Effect-native Anthropic provider (supplementary — for AiLanguageModel)
// ---------------------------------------------------------------------------

/**
 * AnthropicAILayer provides the @effect/ai AiLanguageModel service backed by
 * Anthropic's Claude, using @effect/ai-anthropic.
 *
 * Use this layer for Effect-native AI operations that don't need SSE streaming:
 *   - generateText (summaries, classification, structured output)
 *   - AiChat multi-turn sessions
 *   - Any code that yields* AiLanguageModel
 *
 * Correct usage in a service or server action:
 *   import { AiLanguageModel } from "@effect/ai"
 *   import { AnthropicAILayer } from "@/layers/AILayer"
 *
 *   const program = Effect.gen(function* () {
 *     const model = yield* AiLanguageModel
 *     const response = yield* model.generateText({ prompt: "Hello" })
 *     return response.text
 *   })
 *   await Effect.runPromise(program.pipe(Effect.provide(AnthropicAILayer)))
 *
 * Setup: @effect/ai-anthropic requires @effect/platform (for HttpClient).
 * For the Next.js server environment (Node.js), provide NodeHttpClient:
 *
 *   import { NodeHttpClient } from "@effect/platform-node"
 *   import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic"
 *
 *   export const AnthropicAILayer = AnthropicLanguageModel.layer({
 *     model: "claude-3-5-sonnet-20241022",
 *   }).pipe(
 *     Layer.provide(
 *       AnthropicClient.layerConfig({
 *         apiKey: Config.redacted("ANTHROPIC_API_KEY"),
 *       }),
 *     ),
 *     Layer.provide(NodeHttpClient.layer),
 *   )
 *
 * This pattern is ready to uncomment once @effect/platform-node is installed
 * and peer dependencies are aligned to @effect/ai-anthropic's requirements.
 * See: https://github.com/Effect-TS/effect/tree/main/packages/ai
 */
export const AnthropicAILayer: Layer.Layer<never, never, never> = Layer.empty

