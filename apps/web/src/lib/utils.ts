import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Combine Tailwind classes safely (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Format an ISO timestamp to a human-readable time string. */
export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

/** Truncate a string with ellipsis if longer than maxLength. */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + "..."
}

/** Try to pretty-print a string as JSON; return the original if it's not JSON. */
export function tryFormatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
