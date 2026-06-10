/**
 * Layer composition — the application's dependency graph.
 *
 * WHY COMPOSE LAYERS HERE?
 * Each service declares what it needs (its requirements). Layers compose
 * those requirements into a graph. This file is the "wiring" that connects
 * everything together, separate from any business logic.
 *
 * Layer.provide(A, B) means: "give Layer A the services it needs from Layer B".
 * Layer.merge(A, B) means: "combine both layers into a single context".
 *
 * The resulting AppLayer satisfies all requirements — callers only need to
 * provide(AppLayer) to run any program in this application.
 *
 * To switch from the real MCP server to the mock (e.g. in tests):
 *   Change `McpClientLive` → `McpClientMock` on the line below.
 *   NOTHING ELSE CHANGES. This is the power of dependency injection via Layers.
 */

import { Layer } from "effect"
import { McpClientLive, McpClientMock } from "./services/mcp-client"
import { ChatServiceLive } from "./services/chat-service"

// Determine whether to use the real Rust server or the mock.
// The mock is used when MCP_SERVER_PATH is not set (e.g. during development
// before the Rust binary is built).
const McpLayer =
  process.env.MCP_SERVER_PATH ? McpClientLive : McpClientMock

/**
 * ChatLayer satisfies both McpClientService and ChatService.
 * ChatServiceLive requires McpClientService — we provide it here.
 */
export const ChatLayer = Layer.provide(ChatServiceLive, McpLayer)

/**
 * AppLayer — the complete application context.
 * Provide this to any Effect program that needs application services.
 */
export const AppLayer = ChatLayer
