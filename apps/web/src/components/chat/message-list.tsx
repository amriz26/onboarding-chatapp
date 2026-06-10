"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "./message-item"
import type { Message } from "ai"

interface MessageThreadProps {
  messages: Message[]
  isLoading: boolean
}

/**
 * MessageThread — AI SDK Elements thread container.
 *
 * Renders the ordered list of messages produced by useChat. Each Message
 * object from the AI SDK carries typed `parts` — text deltas, tool invocations,
 * reasoning tokens — which MessageItem renders with appropriate components.
 *
 * Auto-scrolls to the bottom whenever the message list changes or streaming
 * is in progress, using a ref + useEffect to avoid forced layout.
 */
export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const lastMessage = messages.at(-1)
  const isStreaming = isLoading && lastMessage?.role === "assistant"

  if (messages.length === 0) {
    return <EmptyState />
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col py-4">
        {messages.map((message, idx) => (
          <MessageItem
            key={message.id}
            message={message}
            isStreaming={isStreaming && idx === messages.length - 1}
          />
        ))}

        {/* Thinking indicator — shown before the first assistant token arrives */}
        {isLoading && lastMessage?.role !== "assistant" && <ThinkingIndicator />}

        <div ref={bottomRef} className="h-4" />
      </div>
    </ScrollArea>
  )
}

function EmptyState() {
  const suggestions = [
    "What time is it?",
    "Calculate sqrt(144) + 8",
    "Weather in London?",
    "What is 15% of 340?",
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-muted-foreground">
      <div className="text-5xl select-none">💬</div>
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">Start a conversation</p>
        <p className="text-sm mt-1">
          Ask about time, math, or weather — tools run on the Rust MCP server.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {suggestions.map((s) => (
          <span
            key={s}
            className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-xs text-muted-foreground select-none">
        AI
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted border border-border px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
      </div>
    </div>
  )
}
