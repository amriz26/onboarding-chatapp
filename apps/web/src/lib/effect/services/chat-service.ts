/**
 * ChatService — orchestrates AI streaming with MCP tool integration.
 *
 * This service:
 *   1. Fetches MCP tools from the Rust server (via McpClientService).
 *   2. Converts MCP JSON Schemas into Zod schemas (which the AI SDK requires).
 *   3. Creates execute() functions that call MCP when the AI invokes a tool.
 *   4. Returns a configured streamText result for the API route to stream.
 *
 * WHY SEPARATE THIS FROM THE ROUTE?
 *   The API route should be a thin adapter: parse → service → respond.
 *   Business logic (tool wiring, provider config) lives here so it can be
 *   tested independently and reused across multiple routes.
 *
 * Effect.gen + yield* is Effect's version of async/await with typed errors.
 * Each yield* unwraps the success value or propagates the typed error.
 */

import { anthropic } from "@ai-sdk/anthropic"
import { streamText, type CoreMessage, tool } from "ai"
import { Context, Effect, Layer } from "effect"
import { z } from "zod"
import { AiApiError } from "../errors"
import { McpClientService } from "./mcp-client"

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface ChatServiceApi {
  /**
   * Build and return a streamText call pre-configured with MCP tools.
   * The API route pipes the return value directly into a streaming HTTP response.
   */
  readonly streamChat: (
    messages: CoreMessage[],
  ) => Effect.Effect<
    ReturnType<typeof streamText>,
    AiApiError,
    never
  >
}

export class ChatService extends Context.Tag("ChatService")<
  ChatService,
  ChatServiceApi
>() {}

// ---------------------------------------------------------------------------
// Helpers — convert MCP JSON Schema → Zod schema
// ---------------------------------------------------------------------------

/**
 * The Vercel AI SDK's `tool()` helper expects a Zod schema for parameters.
 * MCP tools carry a JSON Schema object. We convert it here.
 *
 * For simplicity we generate a permissive Zod schema that accepts the correct
 * types. A production version would recursively handle nested objects, arrays,
 * enums, and $ref references.
 */
function mcpSchemaToZod(
  inputSchema: Record<string, unknown>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const properties = (inputSchema["properties"] ?? {}) as Record<
    string,
    { type?: string; description?: string }
  >
  const required = (inputSchema["required"] ?? []) as string[]

  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [key, prop] of Object.entries(properties)) {
    let field: z.ZodTypeAny

    switch (prop.type) {
      case "number":
      case "integer":
        field = z.number()
        break
      case "boolean":
        field = z.boolean()
        break
      case "array":
        field = z.array(z.unknown())
        break
      default:
        field = z.string()
    }

    if (prop.description) {
      field = field.describe(prop.description)
    }

    shape[key] = required.includes(key) ? field : field.optional()
  }

  return z.object(shape)
}

// ---------------------------------------------------------------------------
// Live Layer
// ---------------------------------------------------------------------------

export const ChatServiceLive: Layer.Layer<
  ChatService,
  never,
  McpClientService
> = Layer.effect(
  ChatService,
  Effect.gen(function* () {
    // Inject McpClientService — Effect resolves this from the Layer graph.
    // The concrete implementation (Live or Mock) is chosen in layers.ts.
    const mcpClient = yield* McpClientService

    const impl: ChatServiceApi = {
      streamChat: (messages: CoreMessage[]) =>
        Effect.gen(function* () {
          // Step 1: Discover tools from the Rust MCP server.
          // On failure we continue with no tools rather than aborting the chat.
          const mcpTools = yield* mcpClient.listTools.pipe(
            Effect.orElse(() => Effect.succeed([])),
          )

          // Step 2: Convert each MCP tool into an AI SDK tool definition.
          const aiTools: Record<string, ReturnType<typeof tool>> = {}

          for (const mcpTool of mcpTools) {
            const toolName = mcpTool.name

            // `tool()` from the AI SDK creates a typed tool definition.
            // parameters: Zod schema for argument validation.
            // execute: called when the AI model invokes this tool.
            aiTools[toolName] = tool({
              description: mcpTool.description ?? `Tool: ${toolName}`,
              parameters: mcpSchemaToZod(
                mcpTool.inputSchema as Record<string, unknown>,
              ),
              // Step 3: Wire execute → MCP callTool.
              // When Claude decides to use a tool, the SDK calls execute(),
              // which forwards the call to the Rust server via MCP.
              execute: async (args: Record<string, unknown>) => {
                const result = await Effect.runPromise(
                  mcpClient.callTool(toolName, args).pipe(
                    Effect.map((content) =>
                      content
                        .filter((c) => c.type === "text" && c.text)
                        .map((c) => c.text ?? "")
                        .join("\n"),
                    ),
                    Effect.orElse(() =>
                      Effect.succeed(`Tool "${toolName}" encountered an error.`),
                    ),
                  ),
                )
                return result
              },
            })
          }

          // Step 4: Call streamText with Claude + MCP tools.
          const streamResult = yield* Effect.try({
            try: () =>
              streamText({
                model: anthropic("claude-3-5-sonnet-20241022"),
                system: `You are a helpful AI assistant with access to external tools via MCP (Model Context Protocol).

Available tools:
- get_current_time: use when the user asks what time it is
- calculate: use when the user asks to compute a math expression
- get_weather_mock: use when the user asks about weather in a specific city

Always prefer using tools when they can answer the question accurately.
Format tool results naturally — don't paste raw JSON at the user.`,
                messages,
                tools: aiTools,
                // Allow the model to make multiple tool calls per response
                // (e.g. calculate AND get time in a single turn).
                maxSteps: 5,
                temperature: 0.7,
              }),
            catch: (cause) =>
              new AiApiError({
                message: `AI streamText call failed: ${String(cause)}`,
                cause,
              }),
          })

          return streamResult
        }),
    }

    return impl
  }),
)
