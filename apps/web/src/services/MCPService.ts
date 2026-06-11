import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { Context, Effect, Layer, Option } from "effect"
import {
  McpConnectionError,
  McpToolCallError,
  McpToolDiscoveryError,
} from "@/lib/effect/errors"
import { ConfigService } from "./ConfigService"

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface MCPServiceApi {
  /**
   * Fetch all tools the Rust MCP server currently exposes.
   * Called once per request so the AI model always gets a fresh list.
   */
  readonly listTools: Effect.Effect<Tool[], McpToolDiscoveryError>

  /**
   * Invoke a named tool on the Rust server.
   * Returns raw MCP content items (usually a single text block).
   */
  readonly callTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Effect.Effect<Array<{ type: string; text?: string }>, McpToolCallError>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/**
 * MCPService is the Effect tag that callers use to depend on this service.
 *
 * Previously named McpClientService — renamed to MCPService to match the
 * project's Effect-first naming conventions (service names are short and
 * describe the capability, not the implementation mechanism).
 */
export class MCPService extends Context.Tag("MCPService")<
  MCPService,
  MCPServiceApi
>() {}

// ---------------------------------------------------------------------------
// Live layer — real connection to the Rust binary
// ---------------------------------------------------------------------------

/**
 * MCPClientLive acquires a real MCP connection (via stdio to the Rust binary).
 *
 * Key change from the previous implementation: the server path is no longer
 * read directly from process.env. It is injected via ConfigService, keeping
 * the service itself free of direct environment access.
 *
 * Layer.scoped means Effect automatically calls the release finalizer (close
 * the MCP connection) when the surrounding Scope is closed — no finally blocks.
 */
export const MCPClientLive: Layer.Layer<
  MCPService,
  McpConnectionError,
  ConfigService
> = Layer.scoped(
  MCPService,
  Effect.gen(function* () {
    const { mcpServerPath } = yield* ConfigService

    // Fail early if the server path is not configured.
    // The caller (MCPLayer) decides whether to use Live or Mock.
    if (Option.isNone(mcpServerPath)) {
      return yield* Effect.fail(
        new McpConnectionError({
          message:
            "MCP_SERVER_PATH is not configured. " +
            "Build the Rust server with `pnpm build:mcp` and set the variable.",
        }),
      )
    }

    const serverPath = mcpServerPath.value

    // Acquire: connect to the Rust binary.
    // Release: disconnect (kill the child process) when the Scope closes.
    const client = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const transport = new StdioClientTransport({
            command: serverPath,
            args: [],
          })
          const mcpClient = new Client(
            { name: "effect-mcp-web", version: "0.1.0" },
            { capabilities: {} },
          )
          await mcpClient.connect(transport)
          return mcpClient
        },
        catch: (cause) =>
          new McpConnectionError({
            message: `Failed to connect to MCP server at "${serverPath}": ${String(cause)}`,
            cause,
          }),
      }),
      (mcpClient) =>
        Effect.promise(async () => {
          try {
            await mcpClient.close()
          } catch {
            // Ignore close errors — the process may have already exited.
          }
        }),
    )

    return {
      listTools: Effect.tryPromise({
        try: async () => {
          const result = await client.listTools()
          return result.tools
        },
        catch: (cause) =>
          new McpToolDiscoveryError({
            message: `Failed to list tools from MCP server: ${String(cause)}`,
            cause,
          }),
      }),

      callTool: (name: string, args: Record<string, unknown>) =>
        Effect.tryPromise({
          try: async () => {
            const result = await client.callTool({ name, arguments: args })
            return result.content as Array<{ type: string; text?: string }>
          },
          catch: (cause) =>
            new McpToolCallError({
              toolName: name,
              message: `Tool call "${name}" failed: ${String(cause)}`,
              cause,
            }),
        }),
    } satisfies MCPServiceApi
  }),
)

// ---------------------------------------------------------------------------
// Mock layer — in-memory, no Rust binary required
// ---------------------------------------------------------------------------

/**
 * MCPClientMock provides predictable responses without spawning the binary.
 * Used when MCP_SERVER_PATH is not set (e.g. CI, development before building).
 *
 * Because it is a Layer.succeed (not Layer.scoped), it has no lifecycle to
 * manage — no connections are opened or closed.
 */
export const MCPClientMock: Layer.Layer<MCPService, never, never> =
  Layer.succeed(MCPService, {
    listTools: Effect.succeed([
      {
        name: "get_current_time",
        description: "Returns the current UTC time [MOCK]",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "calculate",
        description: "Evaluates an arithmetic expression [MOCK]",
        inputSchema: {
          type: "object",
          properties: {
            expression: { type: "string", description: "Math expression" },
          },
          required: ["expression"],
        },
      },
      {
        name: "get_weather_mock",
        description: "Returns mock weather data [MOCK]",
        inputSchema: {
          type: "object",
          properties: {
            city: { type: "string", description: "City name" },
          },
          required: ["city"],
        },
      },
    ] as Tool[]),

    callTool: (name: string, args: Record<string, unknown>) =>
      Effect.succeed([
        {
          type: "text",
          text: JSON.stringify({
            tool: name,
            args,
            result: "[MOCK RESPONSE]",
            note: "Set MCP_SERVER_URL to use the real HTTP MCP server.",
          }),
        },
      ]),
  })

// ---------------------------------------------------------------------------
// HTTP layer — connects to the remote Node.js MCP HTTP server
// ---------------------------------------------------------------------------

/**
 * MCPClientHttp connects to the Node.js MCP HTTP server via
 * StreamableHTTPClientTransport. Used in production on Vercel when
 * MCP_SERVER_URL is configured to point at the Railway-hosted server.
 *
 * The URL is injected via ConfigService — no direct process.env access here.
 */
export const MCPClientHttp: Layer.Layer<
  MCPService,
  McpConnectionError,
  ConfigService
> = Layer.scoped(
  MCPService,
  Effect.gen(function* () {
    const { mcpServerUrl } = yield* ConfigService

    if (Option.isNone(mcpServerUrl)) {
      return yield* Effect.fail(
        new McpConnectionError({
          message: "MCP_SERVER_URL is not configured.",
        }),
      )
    }

    const url = yield* Effect.try({
      try: () => new URL("/mcp", mcpServerUrl.value),
      catch: () =>
        new McpConnectionError({
          message: `MCP_SERVER_URL "${mcpServerUrl.value}" is not a valid URL. It must start with https://, e.g. https://your-service.up.railway.app`,
        }),
    })

    const client = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const transport = new StreamableHTTPClientTransport(url)
          const mcpClient = new Client(
            { name: "effect-mcp-web", version: "0.1.0" },
            { capabilities: {} },
          )
          await mcpClient.connect(transport)
          return mcpClient
        },
        catch: (cause) =>
          new McpConnectionError({
            message: `Failed to connect to MCP HTTP server at "${url}": ${String(cause)}`,
            cause,
          }),
      }),
      (mcpClient) =>
        Effect.promise(async () => {
          try {
            await mcpClient.close()
          } catch {
            // Ignore close errors.
          }
        }),
    )

    return {
      listTools: Effect.tryPromise({
        try: async () => {
          const result = await client.listTools()
          return result.tools
        },
        catch: (cause) =>
          new McpToolDiscoveryError({
            message: `Failed to list tools from MCP HTTP server: ${String(cause)}`,
            cause,
          }),
      }),

      callTool: (name: string, args: Record<string, unknown>) =>
        Effect.tryPromise({
          try: async () => {
            const result = await client.callTool({ name, arguments: args })
            return result.content as Array<{ type: string; text?: string }>
          },
          catch: (cause) =>
            new McpToolCallError({
              toolName: name,
              message: `Tool call "${name}" failed: ${String(cause)}`,
              cause,
            }),
        }),
    } satisfies MCPServiceApi
  }),
)
