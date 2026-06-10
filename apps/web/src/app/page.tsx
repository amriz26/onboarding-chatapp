/**
 * Home page — full-screen chat interface.
 *
 * The layout splits the viewport into two columns (on large screens):
 *   - Left sidebar: architecture overview and tool documentation
 *   - Right main area: the live chat
 *
 * On small screens the sidebar collapses and only the chat is shown.
 */

import { ChatInterface } from "@/components/chat/chat-interface"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const TOOLS = [
  {
    name: "get_current_time",
    emoji: "🕐",
    description: "Returns current UTC time",
    example: "What time is it?",
  },
  {
    name: "calculate",
    emoji: "🧮",
    description: "Evaluates math expressions",
    example: "What is 25 × 42?",
  },
  {
    name: "get_weather_mock",
    emoji: "🌤️",
    description: "Mock weather by city",
    example: "Weather in Tokyo?",
  },
]

const STACK = [
  { label: "Effect TS", color: "default" as const, desc: "Typed errors · Layers · Schema" },
  { label: "Next.js 15", color: "secondary" as const, desc: "App Router · Streaming" },
  { label: "Rust MCP", color: "tool" as const, desc: "stdio transport · 3 tools" },
  { label: "Claude 3.5", color: "outline" as const, desc: "Tool use · Streaming" },
]

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (hidden on mobile) */}
      <aside className="hidden lg:flex w-72 xl:w-80 flex-col border-r border-border bg-card overflow-y-auto shrink-0">
        <div className="p-5">
          <h2 className="font-bold text-lg text-foreground">Effect MCP Chat</h2>
          <p className="text-xs text-muted-foreground mt-1">
            A production starter demonstrating Effect TS + MCP + Next.js
          </p>
        </div>

        <Separator />

        {/* Stack */}
        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Stack
          </h3>
          <div className="space-y-2">
            {STACK.map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                <Badge variant={item.color} className="shrink-0 mt-0.5">
                  {item.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* MCP Tools */}
        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            MCP Tools (Rust Server)
          </h3>
          <div className="space-y-3">
            {TOOLS.map((tool) => (
              <div key={tool.name} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{tool.emoji}</span>
                  <code className="text-xs font-mono text-violet-400">
                    {tool.name}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">{tool.description}</p>
                <p className="text-xs text-muted-foreground/60 italic mt-1">
                  Try: &ldquo;{tool.example}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Effect architecture callouts */}
        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Effect Architecture
          </h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <span className="text-violet-400 font-mono shrink-0">Layer</span>
              <span>Manages MCP connection lifecycle</span>
            </div>
            <div className="flex gap-2">
              <span className="text-violet-400 font-mono shrink-0">Schema</span>
              <span>Validates all API boundaries</span>
            </div>
            <div className="flex gap-2">
              <span className="text-violet-400 font-mono shrink-0">Error</span>
              <span>Typed failures with McpConnectionError etc.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-violet-400 font-mono shrink-0">Effect.gen</span>
              <span>Async orchestration without try/catch</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto p-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground/50 text-center">
            See <code className="font-mono">ARCHITECTURE.md</code> for full docs
          </p>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col min-w-0">
        <ChatInterface />
      </main>
    </div>
  )
}
