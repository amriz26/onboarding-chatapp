"use client"

/**
 * ChatInterface — the top-level chat component.
 *
 * This component owns the chat state via the `useChat` hook from the
 * Vercel AI SDK. It delegates rendering to child components:
 *   - MessageList:  renders all messages + streaming state
 *   - ChatInput:    handles composition and submission
 *
 * WHY `useChat` FROM THE VERCEL AI SDK?
 * `useChat` manages:
 *   - Sending the message history to /api/chat
 *   - Consuming the Server-Sent Events stream
 *   - Updating messages in real-time as tokens arrive
 *   - Tracking loading state
 *   - Error handling with retry
 *
 * This saves hundreds of lines of streaming plumbing code that would
 * otherwise need manual implementation with EventSource or ReadableStream.
 *
 * The Effect architecture lives entirely on the server side. The client
 * side uses React + AI SDK hooks which are the industry standard for
 * streaming chat UIs. You get the best of both worlds.
 */

import { useChat } from "ai/react"
import { MessageList } from "./message-list"
import { ChatInput } from "./chat-input"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ChatInterface() {
  const {
    messages,
    input,
    isLoading,
    error,
    handleInputChange,
    handleSubmit,
    reload,
  } = useChat({
    api: "/api/chat",

    // The AI SDK sends tool results back to the model automatically.
    // maxSteps on the client side lets multi-step tool calls continue
    // beyond the first response if needed.
    maxSteps: 5,

    onError: (err) => {
      console.error("[ChatInterface] stream error:", err)
    },
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-lg">
          🤖
        </div>
        <div>
          <h1 className="font-semibold text-foreground">Effect MCP Chat</h1>
          <p className="text-xs text-muted-foreground">
            Powered by Claude + Rust MCP tools · Effect TS
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Something went wrong</p>
            <p className="text-xs mt-0.5 text-destructive/80">
              {error.message}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => reload()}
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {/* Message list — takes remaining space */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Input */}
      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
