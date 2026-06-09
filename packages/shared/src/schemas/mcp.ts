/**
 * MCP (Model Context Protocol) protocol-level schemas.
 *
 * WHY MCP?
 * MCP is an open standard (by Anthropic) that lets AI assistants discover and
 * call "tools" provided by external servers — in our case a Rust binary.
 * Instead of hard-coding tool logic in the AI application, you declare tools
 * in a separate server. The AI automatically discovers them at runtime.
 *
 * This file models the JSON shapes that flow over the MCP wire so that the
 * TypeScript client can validate incoming data and produce typed values.
 */

import { Schema } from "effect"

// ---------------------------------------------------------------------------
// MCP server info
// ---------------------------------------------------------------------------

export const McpServerInfoSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
})

export type McpServerInfo = Schema.Schema.Type<typeof McpServerInfoSchema>

// ---------------------------------------------------------------------------
// MCP initialize response
// ---------------------------------------------------------------------------

export const McpCapabilitiesSchema = Schema.Struct({
  tools: Schema.optional(Schema.Struct({})),
  resources: Schema.optional(Schema.Struct({})),
  prompts: Schema.optional(Schema.Struct({})),
})

export const McpInitializeResultSchema = Schema.Struct({
  protocolVersion: Schema.String,
  serverInfo: McpServerInfoSchema,
  capabilities: McpCapabilitiesSchema,
})

export type McpInitializeResult = Schema.Schema.Type<typeof McpInitializeResultSchema>

// ---------------------------------------------------------------------------
// MCP tool list response
// ---------------------------------------------------------------------------

import { McpToolSchema } from "./tool.js"

export const McpListToolsResultSchema = Schema.Struct({
  tools: Schema.Array(McpToolSchema),
  nextCursor: Schema.optional(Schema.String),
})

export type McpListToolsResult = Schema.Schema.Type<typeof McpListToolsResultSchema>

// ---------------------------------------------------------------------------
// MCP call tool response
// ---------------------------------------------------------------------------

/** Raw MCP content item — used in the wire format. */
export const McpContentItemSchema = Schema.Union(
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

export type McpContentItem = Schema.Schema.Type<typeof McpContentItemSchema>

export const McpCallToolResultSchema = Schema.Struct({
  content: Schema.Array(McpContentItemSchema),
  isError: Schema.optional(Schema.Boolean),
})

export type McpCallToolResult = Schema.Schema.Type<typeof McpCallToolResultSchema>

// ---------------------------------------------------------------------------
// Full MCP response envelope (for generic validation at the boundary)
// ---------------------------------------------------------------------------

/**
 * We don't model every possible MCP JSON-RPC envelope here — just the
 * success / error discriminant that we check before deeper parsing.
 */
export const McpResponseSchema = Schema.Union(
  Schema.Struct({
    ok: Schema.Literal(true),
    data: Schema.Unknown,
  }),
  Schema.Struct({
    ok: Schema.Literal(false),
    error: Schema.Struct({
      code: Schema.Number,
      message: Schema.String,
    }),
  }),
)

export type McpResponse = Schema.Schema.Type<typeof McpResponseSchema>
