/**
 * Tool-related schemas — shared types for MCP tool requests and results.
 *
 * These mirror the MCP protocol's CallToolRequest / CallToolResult shapes
 * so both the server-side service layer and any client-side display components
 * can use the same validated types.
 */

import { Schema } from "effect"

// ---------------------------------------------------------------------------
// Tool definition (what an MCP server exposes)
// ---------------------------------------------------------------------------

/** JSON Schema sub-object for a single tool property. */
export const ToolPropertySchema = Schema.Struct({
  type: Schema.String,
  description: Schema.optional(Schema.String),
  enum: Schema.optional(Schema.Array(Schema.String)),
})

export type ToolProperty = Schema.Schema.Type<typeof ToolPropertySchema>

/** The full input schema a tool advertises. */
export const ToolInputSchemaSchema = Schema.Struct({
  type: Schema.Literal("object"),
  properties: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  required: Schema.optional(Schema.Array(Schema.String)),
})

export type ToolInputSchema = Schema.Schema.Type<typeof ToolInputSchemaSchema>

/** A tool listed by the MCP server. */
export const McpToolSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  inputSchema: ToolInputSchemaSchema,
})

export type McpTool = Schema.Schema.Type<typeof McpToolSchema>

// ---------------------------------------------------------------------------
// Tool request (what the AI model sends when it wants to call a tool)
// ---------------------------------------------------------------------------

export const ToolRequestSchema = Schema.Struct({
  /** Unique id assigned by the AI provider for this specific call. */
  toolCallId: Schema.String,
  toolName: Schema.String,
  /** Raw arguments — validated against the tool's own schema separately. */
  args: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

export type ToolRequest = Schema.Schema.Type<typeof ToolRequestSchema>

// ---------------------------------------------------------------------------
// Tool response (what we send back to the AI model)
// ---------------------------------------------------------------------------

/** A single piece of content in an MCP tool result. */
export const ToolContentSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("text"),
    text: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("image"),
    data: Schema.String,
    mimeType: Schema.String,
  }),
)

export type ToolContent = Schema.Schema.Type<typeof ToolContentSchema>

export const ToolResponseSchema = Schema.Struct({
  toolCallId: Schema.String,
  toolName: Schema.String,
  result: Schema.Array(ToolContentSchema),
  isError: Schema.optional(Schema.Boolean),
})

export type ToolResponse = Schema.Schema.Type<typeof ToolResponseSchema>
