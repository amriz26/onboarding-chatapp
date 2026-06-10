/**
 * McpClientService — Effect service that wraps the MCP TypeScript SDK.
 *
 * WHY A SERVICE?
 * In Effect, a "Service" is a named capability (think: interface + DI token).
 * You define WHAT a service can do here, and separately define HOW it is
 * implemented (in the Layer). Code that uses the service only depends on the
 * interface — it is completely decoupled from the implementation.
 *
 * This means:
 *   - Tests can provide a mock Layer with predictable tool responses.
 *   - You can swap the Rust MCP server for a different implementation without
 *     changing any caller code.
 *   - The type signature of every Effect that uses this service explicitly
 *     states that it requires McpClientService.
 *
 * WHY A LAYER?
 * A Layer is a recipe for constructing a service. It can:
 *   - Acquire resources (connect to the MCP server process)
 *   - Release resources on shutdown (close the stdio pipe)
 *   - Depend on other services (config, logger, etc.)
 *
 * Effect's runtime automatically calls the release finalizer when the scope
 * ends — whether the program completed successfully or not. No finally blocks.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { Context, Effect, Layer } from "effect"
import {
  McpConnectionError,
  McpToolCallError,
  McpToolDiscoveryError,
} from "../errors"

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/** The public API of the MCP client service. */
export interface McpClientServiceApi {
  /**
   * Fetch the list of tools the Rust server currently exposes.
   * This is called once per request so the AI model always gets a fresh list.
   */
  readonly listTools: Effect.Effect<Tool[], McpToolDiscoveryError>

  /**
   * Invoke a specific tool on the Rust server.
   *
   * @param name    - MCP tool name (e.g. "get_current_time")
   * @param args    - Arguments matching the tool's JSON Schema
   * @returns       - Array of content items (usually a single text block)
   */
  readonly callTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Effect.Effect<
    Array<{ type: string; text?: string }>,
    McpToolCallError
  >
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/**
 * Context.Tag is the "key" that Effect's DI system uses to look up the service.
 * Think of it as a typed symbol that identifies McpClientService in the Context.
 *
 * The generic parameters are:
 *   Context.Tag<Identifier, ServiceInterface>
 */
export class McpClientService extends Context.Tag("McpClientService")<
  McpClientService,
  McpClientServiceApi
>() {}

// ---------------------------------------------------------------------------
// Live Layer (the real implementation)
// ---------------------------------------------------------------------------

/**
 * McpClientLive creates a real MCP client connection to the Rust binary.
 *
 * Layer.scoped means the Layer creates a resource that lives until the scope
 * is closed. Effect.acquireRelease pairs acquisition with cleanup.
 *
 * The connection lifecycle:
 *   1. Spawn the Rust binary as a child process (via StdioClientTransport).
 *   2. Run the MCP initialize handshake.
 *   3. Provide the service to callers.
 *   4. On scope close, disconnect the client (kills the child process).
 */
export const McpClientLive: Layer.Layer<
  McpClientService,
  McpConnectionError,
  never
> = Layer.scoped(
  McpClientService,
  Effect.gen(function* () {
    // Read the path to the compiled Rust binary from the environment.
    // In production you'd use Effect's Config module; here we read directly
    // to keep the example focused on MCP.
    const serverPath = process.env.MCP_SERVER_PATH
    if (!serverPath) {
      yield* Effect.fail(
        new McpConnectionError({
          message:
            "MCP_SERVER_PATH environment variable is not set. " +
            "Build the Rust server with `pnpm build:mcp` and set the path.",
        }),
      )
    }

    // Acquire: create the client and transport, then connect.
    const client = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const transport = new StdioClientTransport({
            command: serverPath!,
            args: [],
          })

          const mcpClient = new Client(
            { name: "effect-mcp-web", version: "0.1.0" },
            { capabilities: {} },
          )

          // connect() runs the MCP initialize handshake over stdio.
          await mcpClient.connect(transport)
          return mcpClient
        },
        catch: (cause) =>
          new McpConnectionError({
            message: `Failed to connect to MCP server at ${serverPath}: ${String(cause)}`,
            cause,
          }),
      }),
      // Release: cleanly disconnect when the scope closes.
      (mcpClient) =>
        Effect.promise(async () => {
          try {
            await mcpClient.close()
          } catch {
            // Ignore close errors — the process may have already exited.
          }
        }),
    )

    // Build and return the service implementation.
    return {
      listTools: Effect.tryPromise({
        try: async () => {
          const result = await client.listTools()
          return result.tools
        },
        catch: (cause) =>
          new McpToolDiscoveryError({
            message: `Failed to list tools: ${String(cause)}`,
            cause,
          }),
      }),

      callTool: (name: string, args: Record<string, unknown>) =>
        Effect.tryPromise({
          try: async () => {
            const result = await client.callTool({
              name,
              arguments: args,
            })
            // The MCP SDK returns content as an array of typed items.
            return result.content as Array<{ type: string; text?: string }>
          },
          catch: (cause) =>
            new McpToolCallError({
              toolName: name,
              message: `Tool call failed for "${name}": ${String(cause)}`,
              cause,
            }),
        }),
    } satisfies McpClientServiceApi
  }),
)

// ---------------------------------------------------------------------------
// Mock Layer (for testing / development without the Rust binary)
// ---------------------------------------------------------------------------

/**
 * McpClientMock provides predictable, in-memory responses.
 * Use this when:
 *   - The Rust binary is not built yet
 *   - Writing unit tests
 *   - Running in CI without the binary
 *
 * Switch between Live and Mock by changing which Layer you provide.
 * No caller code changes needed.
 */
export const McpClientMock: Layer.Layer<McpClientService, never, never> =
  Layer.succeed(McpClientService, {
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
            note: "This is a mock — set MCP_SERVER_PATH to use the real Rust server.",
          }),
        },
      ]),
  })
