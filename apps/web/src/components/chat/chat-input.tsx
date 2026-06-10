"use client"

/**
 * ChatInput — the message composition area at the bottom of the chat.
 *
 * Features:
 *   - Auto-growing textarea (grows with content, max 200px)
 *   - Submit on Enter, newline on Shift+Enter
 *   - Character count with visual warning near limit
 *   - Disabled while the AI is streaming a response
 *   - Effect Schema validation on the client before submission
 *
 * WHY CLIENT-SIDE SCHEMA VALIDATION?
 * We validate the same UserInputSchema here that the server validates in the
 * API route. This gives instant feedback without a round-trip. The server
 * validation is still the source of truth (never trust the client), but
 * showing errors locally improves UX significantly.
 */

import { useRef, useCallback, useState, useEffect } from "react"
import { Schema } from "effect"
import { ArrowUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { UserInputSchema } from "@/lib/schemas"

interface ChatInputProps {
  input: string
  isLoading: boolean
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}

const MAX_CHARS = 4000

export function ChatInput({
  input,
  isLoading,
  onInputChange,
  onSubmit,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Auto-resize the textarea as the user types.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  const charCount = input.length
  const isNearLimit = charCount > MAX_CHARS * 0.8

  // Validate with Effect Schema before submit.
  const validateAndSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      // Effect Schema decode returns Either<ParseError, UserInput>.
      // We use Schema.decodeUnknownEither for synchronous validation.
      const result = Schema.decodeUnknownEither(UserInputSchema)({ content: input })

      if (result._tag === "Left") {
        setValidationError("Message cannot be empty or exceeds 4000 characters.")
        return
      }

      setValidationError(null)
      onSubmit(e)
    },
    [input, onSubmit],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        // Submit via the form submit event so onSubmit is called once.
        e.currentTarget.form?.requestSubmit()
      }
    },
    [],
  )

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <form onSubmit={validateAndSubmit} className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => {
            setValidationError(null)
            onInputChange(e)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
          disabled={isLoading}
          className={cn(
            "w-full resize-none rounded-xl border bg-background px-4 py-3 pr-12",
            "text-sm leading-relaxed placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "max-h-[200px] overflow-y-auto",
            validationError && "border-destructive focus:ring-destructive",
          )}
          aria-label="Chat message"
          aria-invalid={!!validationError}
        />

        {/* Submit button — overlaid inside the textarea */}
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
          className={cn(
            "absolute bottom-2 right-2 h-8 w-8 rounded-lg",
            "transition-all duration-150",
          )}
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>
      </form>

      {/* Character count + validation error */}
      <div className="mt-1.5 flex justify-between px-1">
        <span className="text-[11px] text-destructive min-h-[16px]">
          {validationError}
        </span>
        <span
          className={cn(
            "text-[11px]",
            isNearLimit ? "text-amber-500" : "text-muted-foreground/50",
          )}
        >
          {charCount}/{MAX_CHARS}
        </span>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/40 mt-1">
        AI can make mistakes. Verify important information.
      </p>
    </div>
  )
}
