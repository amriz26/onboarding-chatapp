/**
 * Effect runtime — how we run Effect programs in different contexts.
 *
 * Effect programs don't run themselves. They are descriptions of computations.
 * You need a "runner" to execute them. Effect provides several:
 *
 *   Effect.runPromise(program)
 *     - Converts an Effect to a Promise. Good for one-shot calls.
 *     - Requires the Effect to have no unresolved requirements (R = never).
 *
 *   Effect.runPromiseExit(program)
 *     - Like runPromise but returns Exit<E, A> instead of throwing on failure.
 *     - Useful when you want to handle errors without try/catch.
 *
 *   ManagedRuntime.make(layer)
 *     - Creates a long-lived runtime that holds a shared Layer instance.
 *     - The Layer is initialized once and shared across many Effect.run calls.
 *     - Ideal for server-side singletons (database pools, connections, etc.).
 *
 * For this application we use:
 *   - Effect.runPromise with per-request Layers for scoped resources (MCP client).
 *   - Direct Effect.runPromise for simple utility functions.
 */

import { Effect, Exit, Cause } from "effect"

/**
 * Run an Effect program and return the result.
 * If the effect fails, throws a JavaScript Error with the failure message.
 *
 * Use this in Server Actions and API routes where you want Promise semantics.
 */
export async function runEffect<A, E>(
  effect: Effect.Effect<A, E, never>,
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect)

  if (Exit.isSuccess(exit)) {
    return exit.value
  }

  // Convert the Effect failure into a plain Error for the route handler.
  const cause = exit.cause
  if (Cause.isFailType(cause)) {
    const error = cause.error
    if (error instanceof Error) throw error
    throw new Error(String(error))
  }

  throw new Error(`Effect failed: ${Cause.pretty(cause)}`)
}

/**
 * Run an Effect and return an Exit — never throws.
 * Useful when you want to inspect success vs failure in the caller.
 */
export async function runEffectExit<A, E>(
  effect: Effect.Effect<A, E, never>,
): Promise<Exit.Exit<A, E>> {
  return Effect.runPromiseExit(effect)
}
