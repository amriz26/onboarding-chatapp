/**
 * Chat schemas — shared between the Next.js API route and any future consumers.
 *
 * WHY EFFECT SCHEMA?
 * Traditional TypeScript types only exist at compile time. When data crosses a
 * network boundary (HTTP request, environment variable, MCP response) TypeScript
 * cannot verify it at runtime. Effect Schema solves this by combining a runtime
 * validator with a TypeScript type — you get one source of truth for both.
 *
 * Schema.Struct({ ... }) produces:
 *   - A runtime codec (parse / encode)
 *   - A TypeScript type via Schema.Schema.Type<typeof MySchema>
 *
 * You never write a separate `interface` and a separate `zod.object` — the
 * schema IS both.
 */

import { Schema } from "effect"

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export const RoleSchema = Schema.Literal("user", "assistant", "system", "tool")
export type Role = Schema.Schema.Type<typeof RoleSchema>

// ---------------------------------------------------------------------------
// Tool call / invocation embedded in a message
// ---------------------------------------------------------------------------

/** A tool the assistant decided to invoke. */
export const ToolInvocationSchema = Schema.Struct({
  /** Unique call id (assigned by the AI provider). */
  toolCallId: Schema.String,
  /** Which tool was called (maps to the MCP tool name). */
  toolName: Schema.String,
  /** Arguments the model passed — untyped because tool schemas vary. */
  args: Schema.Unknown,
  /** Present once the tool has returned. */
  result: Schema.optional(Schema.Unknown),
  /** One of the AI SDK lifecycle states. */
  state: Schema.Literal("partial-call", "call", "result"),
})

export type ToolInvocation = Schema.Schema.Type<typeof ToolInvocationSchema>

// ---------------------------------------------------------------------------
// Chat message
// ---------------------------------------------------------------------------

/**
 * A single message in the conversation.
 *
 * We model this after the Vercel AI SDK `Message` shape so it can be passed
 * directly to `useChat` / `streamText` without conversion.
 */
export const ChatMessageSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  role: RoleSchema,
  content: Schema.String,
  /** Tool invocations attached to an assistant message. */
  toolInvocations: Schema.optional(Schema.Array(ToolInvocationSchema)),
  /** ISO-8601 timestamp — added server-side, optional on the client. */
  createdAt: Schema.optional(Schema.String),
})

export type ChatMessage = Schema.Schema.Type<typeof ChatMessageSchema>

// ---------------------------------------------------------------------------
// API request / response
// ---------------------------------------------------------------------------

/** Shape of the body POSTed to /api/chat. */
export const ChatRequestSchema = Schema.Struct({
  /** Full conversation so far (the AI SDK sends the whole history). */
  messages: Schema.Array(ChatMessageSchema),
  /** Optional conversation id for future persistence. */
  conversationId: Schema.optional(Schema.String),
})

export type ChatRequest = Schema.Schema.Type<typeof ChatRequestSchema>

/** Shape returned by a non-streaming endpoint (not used for SSE). */
export const ChatResponseSchema = Schema.Struct({
  message: ChatMessageSchema,
  conversationId: Schema.String,
})

export type ChatResponse = Schema.Schema.Type<typeof ChatResponseSchema>

// ---------------------------------------------------------------------------
// User input (validated before sending to the API)
// ---------------------------------------------------------------------------

export const UserInputSchema = Schema.Struct({
  content: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Message cannot be empty" }),
    Schema.maxLength(4000, { message: () => "Message is too long (max 4000 chars)" }),
  ),
})

export type UserInput = Schema.Schema.Type<typeof UserInputSchema>
