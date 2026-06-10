"use client"

/**
 * ToolCallDisplay — renders a single MCP tool invocation inline in the chat.
 *
 * When the AI model calls a tool, the AI SDK attaches a `toolInvocations`
 * array to the assistant message. Each invocation goes through states:
 *   1. "call"    — the model has decided to call the tool (args sent)
 *   2. "result"  — the tool has returned (result received)
 *
 * We show a collapsible card for each tool call so the user can see exactly
 * what the AI did and what it got back. This transparency is important for
 * trust in AI-assisted workflows.
 */

import { useState } from "react"
import { ChevronDown, ChevronRight, Wrench, CheckCircle2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn, tryFormatJson } from "@/lib/utils"
import type { ToolInvocation } from "@/lib/schemas"

interface ToolCallDisplayProps {
  invocation: ToolInvocation
}

const TOOL_ICONS: Record<string, string> = {
  get_current_time: "🕐",
  calculate: "🧮",
  get_weather_mock: "🌤️",
}

export function ToolCallDisplay({ invocation }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false)
  const icon = TOOL_ICONS[invocation.toolName] ?? "🔧"
  const hasResult = invocation.state === "result"
  const isPending = invocation.state === "call" || invocation.state === "partial-call"

  return (
    <div
      className={cn(
        "my-2 rounded-lg border text-xs font-mono",
        "border-violet-500/30 bg-violet-500/5",
        "animate-fade-in",
      )}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-violet-500/10 rounded-lg transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-base">{icon}</span>
        <span className="flex-1 text-violet-300 font-semibold">
          {invocation.toolName}
        </span>

        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        )}

        <Badge variant="tool" className="text-[10px]">
          {hasResult ? "done" : "calling"}
        </Badge>

        {expanded ? (
          <ChevronDown className="h-3 w-3 text-violet-400" />
        ) : (
          <ChevronRight className="h-3 w-3 text-violet-400" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-violet-500/20 px-3 py-2 space-y-2">
          {/* Arguments */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-violet-400/70 mb-1">
              Arguments
            </div>
            <pre className="text-violet-200/80 whitespace-pre-wrap break-all leading-relaxed">
              {tryFormatJson(JSON.stringify(invocation.args))}
            </pre>
          </div>

          {/* Result */}
          {hasResult && invocation.result !== undefined && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">
                Result
              </div>
              <pre className="text-emerald-200/80 whitespace-pre-wrap break-all leading-relaxed">
                {typeof invocation.result === "string"
                  ? tryFormatJson(invocation.result)
                  : tryFormatJson(JSON.stringify(invocation.result))}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
