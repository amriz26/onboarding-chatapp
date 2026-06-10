import { Layer } from "effect"
import { MCPClientLive, MCPClientMock } from "@/services/MCPService"
import { ConfigLive } from "@/services/ConfigService"

/**
 * MCPLive — real connection to the Rust binary, with ConfigService provided.
 *
 * MCPClientLive depends on ConfigService for the server path.
 * We bake ConfigLive in here so the composed layer satisfies all requirements
 * without callers having to provide ConfigService separately.
 */
export const MCPLive = MCPClientLive.pipe(Layer.provide(ConfigLive))

/**
 * MCPMock — in-memory mock, no Rust binary required.
 * Identical API to MCPLive; produced by Layer.succeed so it has no lifecycle.
 */
export const MCPMock = MCPClientMock

/**
 * MCPLayer — the active MCP layer for the current environment.
 *
 * Selection is made once at module load time:
 *   - MCP_SERVER_PATH set   → MCPLive (spawns the Rust binary)
 *   - MCP_SERVER_PATH unset → MCPMock (in-memory predictable responses)
 *
 * No caller code changes when switching between live and mock.
 */
export const MCPLayer = process.env.MCP_SERVER_PATH ? MCPLive : MCPMock
