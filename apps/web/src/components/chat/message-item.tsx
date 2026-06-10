"use client"

/**
 * MessageItem — renders a single chat message (user or assistant).
 *
 * For assistant messages with tool calls, it renders ToolCallDisplay cards
 * before the text content so the user can see what tools were used.
 *
 * Streaming: while the AI is still generating, the message content grows
 * in place. The AI SDK's useChat hook handles this — the message object
 * is updated in real-time as chunks arrive.
 */

import { cn, formatTime } from "@/lib/utils"
import { ToolCallDisplay } from "./tool-call-display"
import type { Message } from "ai"

interface MessageItemProps {
  message: Message
  isStreaming?: boolean
}

export function MessageItem({ message, isStreaming = false }: MessageItemProps) {
  const isUser = message.role === "user"
  const isAssistant = message.role === "assistant"
  const timestamp = message.createdAt
    ? formatTime(message.createdAt.toISOString())
    : ""

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 animate-fade-in",
        isUser && "flex-row-reverse",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground border border-border",
        )}
        aria-hidden
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-1",
          isUser && "items-end",
        )}
      >
        {/* Tool invocations (assistant messages only) */}
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

        {/* Message text */}
        {message.content && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted text-foreground rounded-tl-sm border border-border",
            )}
          >
            {/* Whitespace-preserving content render */}
            <span className="whitespace-pre-wrap">{message.content}</span>

            {/* Streaming cursor */}
            {isStreaming && isAssistant && (
              <span className="ml-0.5 inline-block w-0.5 h-4 bg-current animate-blink align-middle" />
            )}
          </div>
        )}

        {/* Timestamp */}
        {timestamp && (
          <span className="text-[10px] text-muted-foreground px-1">
            {timestamp}
          </span>
        )}
      </div>
    </div>
  )
}
