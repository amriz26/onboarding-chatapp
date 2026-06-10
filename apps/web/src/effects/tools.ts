import { jsonSchema, tool, type ToolSet } from "ai"
import { Effect } from "effect"
import type { McpTool } from "@effect-mcp/shared"
import type { McpToolCallError } from "@/lib/effect/errors"

// The shape of MCPService.callTool — passed in to keep this module free of
// any direct service import (avoids a circular dependency chain).
type CallToolFn = (
  name: string,
  args: Record<string, unknown>,
) => Effect.Effect<Array<{ type: string; text?: string }>, McpToolCallError>

/**
 * Convert an array of MCP tool definitions into an AI SDK ToolSet.
 *
 * The critical change vs the previous implementation: `parameters` now uses
 * `jsonSchema()` from the Vercel AI SDK, which accepts a raw JSON Schema
 * object verbatim. MCP tools already carry a JSON Schema in `inputSchema`,
 * so this is a direct pass-through with zero translation overhead.
 *
 * Before (Zod):
 *   parameters: mcpSchemaToZod(mcpTool.inputSchema)  // Zod schema
 *
 * After (jsonSchema):
 *   parameters: jsonSchema(mcpTool.inputSchema)       // JSON Schema passthrough
 *
 * The `execute` callback bridges Effect → Promise at this single boundary.
 * All tool errors are caught and converted to descriptive strings so the AI
 * model receives a human-readable error instead of an unhandled exception.
 */
export function mcpToolsToAiTools(
  mcpTools: readonly McpTool[],
  callTool: CallToolFn,
): ToolSet {
  const aiTools: ToolSet = {}

  for (const mcpTool of mcpTools) {
    const toolName = mcpTool.name

    // tool() is typed with a discriminated union; we assert ToolSet value type
    // to satisfy the container type while preserving the generic information
    // the AI SDK needs to handle streaming tool events correctly.
    aiTools[toolName] = tool({
      description: mcpTool.description ?? `MCP tool: ${toolName}`,

      // Pass the MCP JSON Schema directly — no Zod conversion needed.
      parameters: jsonSchema(
        mcpTool.inputSchema as Parameters<typeof jsonSchema>[0],
      ),

      // Effect → Promise bridge (only boundary where we exit Effect land).
      // args typed as unknown per AI SDK's tool() overload; cast before passing
      // to callTool which needs Record<string, unknown>.
      execute: (args: unknown) =>
        Effect.runPromise(
          callTool(toolName, args as Record<string, unknown>).pipe(
            Effect.map((content) =>
              content
                .filter((c): c is { type: "text"; text: string } =>
                  c.type === "text" && typeof c.text === "string",
                )
                .map((c) => c.text)
                .join("\n"),
            ),
            Effect.orElseSucceed(
              () => `Tool "${toolName}" returned an error or empty result`,
            ),
          ),
        ),
    }) as ToolSet[string]
  }

  return aiTools
}
