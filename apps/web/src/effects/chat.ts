import { type CoreMessage } from "ai"
import { Effect } from "effect"
import { ChatService } from "@/services/ChatService"

/**
 * System prompt defining the AI assistant's persona and tool guidance.
 * Centralised here so it's testable and not buried in a service implementation.
 */
export const SYSTEM_PROMPT = `You are a helpful AI assistant with access to external tools via MCP (Model Context Protocol).

Available tools:
- get_current_time: use when the user asks what time it is
- calculate: use when the user asks to compute a math expression
- get_weather_mock: use when the user asks about weather in a specific city

Always prefer using tools when they can answer the question accurately.
Format tool results naturally — don't paste raw JSON at the user.`

/**
 * Pure Effect program: take a message history, return a streaming AI result.
 *
 * Thin wrapper around ChatService.streamChat that makes the service requirement
 * explicit in the Effect's R type parameter (Requirements = ChatService).
 * Test suites provide a mock ChatService layer; production provides ChatLayer.
 */
export const streamChatProgram = (messages: CoreMessage[]) =>
  Effect.gen(function* () {
    const chat = yield* ChatService
    return yield* chat.streamChat(messages)
  })
