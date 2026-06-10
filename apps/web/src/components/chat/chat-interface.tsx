"use client"

import { useChat } from "ai/react"
import { AlertCircle, RefreshCw, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessageThread } from "./message-list"
import { ChatInput } from "./chat-input"

/**
 * ChatInterface — root chat component.
 *
 * AI SDK Elements integration:
 *   useChat drives all state. The hook manages:
 *     - Sending the full message history to POST /api/chat
 *     - Consuming the SSE data stream produced by toDataStreamResponse()
 *     - Updating messages in real-time as text and tool-call events arrive
 *     - Tracking loading state
 *
 *   Child components (MessageThread, ChatInput) are "AI SDK Element consumers":
 *   they receive the typed message objects and render each part — text parts
 *   inline, tool-invocation parts as collapsible cards, reasoning parts in
 *   a distinct style.
 *
 *   shadcn/ui is used for layout, navigation, and the error banner.
 *   AI SDK Elements (useChat + typed message parts) are used for everything
 *   AI-specific.
 */
export function ChatInterface() {
  const { messages, input, isLoading, error, handleInputChange, handleSubmit, reload } =
    useChat({
      api: "/api/chat",
      // Allow the client to continue processing multi-step tool chains
      // beyond the first AI response turn.
      maxSteps: 5,
      onError: (err) => {
        console.error("[ChatInterface] stream error:", err)
      },
    })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <h1 className="font-semibold text-foreground">Effect MCP Chat</h1>
          <p className="text-xs text-muted-foreground">
            Claude · Rust MCP tools · Effect TS
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={
              isLoading
                ? "h-2 w-2 rounded-full bg-amber-400 animate-pulse"
                : "h-2 w-2 rounded-full bg-emerald-500"
            }
          />
          <span className="text-xs text-muted-foreground">
            {isLoading ? "Thinking…" : "Ready"}
          </span>
        </div>
      </header>

      {/* Error banner (shadcn/ui layout component) */}
      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Something went wrong</p>
            <p className="text-xs mt-0.5 opacity-80">{error.message}</p>
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

      {/* Message thread — AI SDK Elements consumer */}
      <MessageThread messages={messages} isLoading={isLoading} />

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
