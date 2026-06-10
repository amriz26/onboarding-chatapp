import { Layer } from "effect"
import { ChatServiceLive } from "@/services/ChatService"
import { MCPLayer } from "./MCPLayer"
import { AILayer } from "./AILayer"

/**
 * ChatLayer — the full application Layer for the /api/chat endpoint.
 *
 * Dependency graph:
 *
 *   ChatServiceLive
 *     ├── MCPLayer        (MCPService — live or mock, includes ConfigService)
 *     └── AILayer         (AIService — Anthropic Claude, includes ConfigService)
 *
 * ChatServiceLive requires MCPService and AIService. We provide both by merging
 * MCPLayer and AILayer, then providing the result to ChatServiceLive.
 *
 * Layer.merge(A, B) satisfies requirements from both A and B simultaneously.
 * If both A and B internally require ConfigService, Effect deduplicates the
 * layer and instantiates ConfigService only once per scope.
 */
export const ChatLayer = ChatServiceLive.pipe(
  Layer.provide(Layer.merge(MCPLayer, AILayer)),
)

/**
 * AppLayer — the top-level Layer provided to every Effect in this application.
 * Import this in route handlers and server actions instead of constructing
 * the Layer graph inline.
 */
export const AppLayer = ChatLayer
