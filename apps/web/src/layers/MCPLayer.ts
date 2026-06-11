import { Layer } from "effect"
import { MCPClientHttp, MCPClientLive, MCPClientMock } from "@/services/MCPService"
import { ConfigLive } from "@/services/ConfigService"

/** Remote HTTP MCP server (production — Railway). */
export const MCPHttp = MCPClientHttp.pipe(Layer.provide(ConfigLive))

/** Local Rust binary over stdio (local dev with compiled binary). */
export const MCPLive = MCPClientLive.pipe(Layer.provide(ConfigLive))

/** In-memory mock (local dev without binary or URL). */
export const MCPMock = MCPClientMock

/**
 * MCPLayer — active MCP layer selected at module load time.
 *
 *   MCP_SERVER_URL set  → MCPHttp  (remote HTTP server on Railway)
 *   MCP_SERVER_PATH set → MCPLive  (local Rust binary via stdio)
 *   neither             → MCPMock  (in-memory mock)
 */
export const MCPLayer = process.env.MCP_SERVER_URL
  ? MCPHttp
  : process.env.MCP_SERVER_PATH
    ? MCPLive
    : MCPMock
