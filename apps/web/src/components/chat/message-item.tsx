"use client"

import { cn, formatTime } from "@/lib/utils"
import { ToolCallDisplay } from "./tool-call-display"
import type { Message } from "ai"

interface MessageItemProps {
  message: Message
  isStreaming?: boolean
}

/**
 * MessageItem — renders a single message using the AI SDK's `parts` API.
 *
 * AI SDK Elements pattern:
 *   The AI SDK packages each message as an array of typed `parts`:
 *     { type: "text",             text: string }
 *     { type: "tool-invocation",  toolInvocation: ToolInvocation }
 *     { type: "reasoning",        reasoning: string }
 *
 *   Iterating `message.parts` (rather than rendering `message.content`
 *   monolithically) is the recommended AI SDK approach — it preserves the
 *   ordering of text tokens relative to tool calls and makes each element
 *   individually renderable.
 *
 *   When `parts` is not yet populated (rare edge case during hydration),
 *   we fall back to the plain `content` string.
 */
export function MessageItem({ message, isStreaming = false }: MessageItemProps) {
  const isUser = message.role === "user"
  const isAssistant = message.role === "assistant"
  const timestamp = message.createdAt
    ? formatTime(message.createdAt.toISOString())
    : ""

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser && "flex-row-reverse",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium select-none",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground border border-border",
        )}
        aria-hidden
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Content column */}
      <div className={cn("flex max-w-[75%] flex-col gap-1.5", isUser && "items-end")}>
        {/*
         * Render each part in order.
         * AI SDK Elements: parts preserve the interleaving of text tokens and
         * tool calls exactly as they were emitted by the model.
         */}
        {message.parts && message.parts.length > 0
          ? message.parts.map((part, idx) => {
              if (part.type === "text" && part.text) {
                return (
                  <TextBubble
                    key={idx}
                    text={part.text}
                    isUser={isUser}
                    isStreaming={isStreaming && isAssistant && idx === message.parts!.length - 1}
                  />
                )
              }

              if (part.type === "tool-invocation") {
                return (
                  <ToolCallDisplay
                    key={part.toolInvocation.toolCallId}
                    invocation={{
                      toolCallId: part.toolInvocation.toolCallId,
                      toolName: part.toolInvocation.toolName,
                      args: part.toolInvocation.args,
                      result:
                        "result" in part.toolInvocation
                          ? part.toolInvocation.result
                          : undefined,
                      state: part.toolInvocation.state,
                    }}
                  />
                )
              }

              if (part.type === "reasoning" && part.reasoning) {
                return (
                  <div
                    key={idx}
                    className="text-[11px] text-muted-foreground/60 italic px-1"
                  >
                    {part.reasoning}
                  </div>
                )
              }

              return null
            })
          : // Fallback: no parts yet — render raw content + legacy toolInvocations
            (<>
              {isAssistant &&
                message.toolInvocations?.map((inv) => (
                  <ToolCallDisplay
                    key={inv.toolCallId}
                    invocation={{
                      toolCallId: inv.toolCallId,
                      toolName: inv.toolName,
                      args: inv.args,
                      result: "result" in inv ? inv.result : undefined,
                      state: inv.state,
                    }}
                  />
                ))}
              {message.content && (
                <TextBubble
                  text={message.content}
                  isUser={isUser}
                  isStreaming={isStreaming && isAssistant}
                />
              )}
            </>)}

        {timestamp && (
          <span className="text-[10px] text-muted-foreground/60 px-1">
            {timestamp}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TextBubbleProps {
  text: string
  isUser: boolean
  isStreaming?: boolean
}

function TextBubble({ text, isUser, isStreaming = false }: TextBubbleProps) {
  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-muted text-foreground rounded-tl-sm border border-border",
      )}
    >
      <span className="whitespace-pre-wrap">{text}</span>
      {isStreaming && (
        <span className="ml-0.5 inline-block w-0.5 h-4 bg-current animate-blink align-middle" />
      )}
    </div>
  )
}
