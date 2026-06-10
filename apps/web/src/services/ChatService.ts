import { streamText, type CoreMessage, type ToolSet } from "ai"
import { Context, Effect, Layer } from "effect"
import { AiApiError, McpConnectionError, McpToolDiscoveryError } from "@/lib/effect/errors"
import { MCPService } from "./MCPService"
import { AIService } from "./AIService"
import { mcpToolsToAiTools } from "@/effects/tools"

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export type StreamChatError = AiApiError | McpConnectionError | McpToolDiscoveryError

export interface ChatServiceApi {
  /**
   * Orchestrate an AI streaming response for the given message history.
   *
   * Internally:
   *   1. Fetches MCP tool definitions from MCPService.
   *   2. Converts them to AI SDK tools using mcpToolsToAiTools (no Zod).
   *   3. Delegates to AIService.streamChat with the constructed tool set.
   *
   * Returns the raw StreamTextResult — the caller (route handler) converts it
   * to an HTTP streaming response with toDataStreamResponse().
   */
  readonly streamChat: (
    messages: CoreMessage[],
  ) => Effect.Effect<ReturnType<typeof streamText>, StreamChatError>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/**
 * ChatService is the primary orchestration service.
 * It has no AI provider knowledge and no MCP transport knowledge — those live
 * in AIService and MCPService respectively. ChatService only wires them together.
 */
export class ChatService extends Context.Tag("ChatService")<
  ChatService,
  ChatServiceApi
>() {}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

/**
 * ChatServiceLive requires MCPService and AIService at construction time.
 * Effect resolves both from the Layer graph — the concrete implementations
 * (live vs mock) are chosen in the layer files, not here.
 */
export const ChatServiceLive: Layer.Layer<
  ChatService,
  never,
  MCPService | AIService
> = Layer.effect(
  ChatService,
  Effect.gen(function* () {
    const mcpService = yield* MCPService
    const aiService = yield* AIService

    return {
      streamChat: (messages: CoreMessage[]) =>
        Effect.gen(function* () {
          // Fetch tools — on MCP failure we continue with no tools rather
          // than aborting the entire chat request.
          const mcpTools = yield* mcpService.listTools.pipe(
            Effect.orElseSucceed(() => []),
          )

          // Convert MCP JSON Schema tool definitions → AI SDK tool objects.
          // mcpToolsToAiTools uses jsonSchema() from the AI SDK (no Zod).
          const aiTools: ToolSet = mcpToolsToAiTools(mcpTools, mcpService.callTool)

          return yield* aiService.streamChat(messages, aiTools)
        }),
    } satisfies ChatServiceApi
  }),
)
