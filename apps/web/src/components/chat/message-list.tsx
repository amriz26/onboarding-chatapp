"use client"

/**
 * MessageList — scrollable container for all chat messages.
 *
 * Auto-scrolls to the bottom when a new message arrives or the current
 * message is still streaming. Uses a ref + useEffect pattern to avoid
 * layout thrashing.
 */

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "./message-item"
import type { Message } from "ai"

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever messages change or streaming is in progress.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const lastMessage = messages.at(-1)
  const isStreaming =
    isLoading && lastMessage?.role === "assistant"

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground px-4">
        <div className="text-5xl">💬</div>
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            Start a conversation
          </p>
          <p className="text-sm mt-1">
            Try asking: "What time is it?", "Calculate 25 × 42", or "What's
            the weather in Tokyo?"
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {[
            "What time is it?",
            "Calculate sqrt(144) + 8",
            "Weather in London?",
            "What is 15% of 340?",
          ].map((suggestion) => (
            <span
              key={suggestion}
              className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
            >
              {suggestion}
            </span>
          ))}
        </div>
      </div>
    )
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

        {/* Loading state — AI is thinking (before first token) */}
        {isLoading && lastMessage?.role !== "assistant" && (
          <div className="flex gap-3 px-4 py-3 animate-fade-in">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-sm text-muted-foreground">
              AI
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted border border-border px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>
    </ScrollArea>
  )
}
