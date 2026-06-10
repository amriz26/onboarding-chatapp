# Architecture Overview

## The Big Picture

This project is a full-stack demonstration of three interconnected technologies:

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React + Vercel AI SDK)                                │
│    useChat() ──► SSE stream ──► MessageList + ToolCallDisplay   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP POST /api/chat
┌────────────────────────────▼────────────────────────────────────┐
│  Next.js Server (Effect TS layer)                               │
│                                                                 │
│  route.ts                                                       │
│    Schema.decodeUnknown(request)  ← validates at boundary       │
│    Effect.provide(ChatLayer)      ← dependency injection        │
│    ChatService.streamChat()       ← orchestration               │
│      │                                                          │
│      ├─ McpClientService.listTools()  ← discovers tools         │
│      ├─ mcpInputSchemaToZod()         ← converts schemas        │
│      ├─ tool.execute → callTool()     ← invokes Rust tools      │
│      └─ streamText(claude, tools)     ← AI streaming            │
└────────────────────────────┬────────────────────────────────────┘
                             │ stdio (JSON-RPC 2.0 / MCP)
┌────────────────────────────▼────────────────────────────────────┐
│  Rust MCP Server                                                │
│    ServerHandler                                                │
│      list_tools() → [get_current_time, calculate, weather]      │
│      call_tool("calculate", {expression}) → result              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Effect TS?

Traditional Node.js async code has several pain points:

| Problem | Traditional approach | Effect approach |
|---------|---------------------|-----------------|
| What errors can a function throw? | Documentation / hope | Compile-time type `Effect<A, E, R>` |
| Resource cleanup | `try/finally` everywhere | `Layer.scoped` + `acquireRelease` |
| Dependency injection | Constructor arguments / singletons | `Context.Tag` + `Layer.provide` |
| Runtime validation | Manual type guards / zod | `Schema.decodeUnknown` |
| Retries / timeouts | Manual `setTimeout` / libraries | `Effect.retry`, `Effect.timeout` |

### The Effect type

```
Effect<SuccessValue, ErrorType, RequiredServices>
     ^              ^            ^
     What it        What can     What services
     produces       go wrong     it needs
```

Every function in this codebase that uses Effect carries all three in its type signature.
TypeScript checks that you handle errors and provide all required services.

---

## Layer Architecture

Layers form a directed acyclic graph of dependencies:

```
AppLayer
  └── ChatLayer
        ├── ChatServiceLive   (requires McpClientService)
        └── McpClientLive     (requires: nothing)
```

`Layer.provide(ChatServiceLive, McpClientLive)` wires them together.
The result is a `Layer<ChatService, McpConnectionError, never>` — no unresolved requirements.

**Effect.scoped** in the API route ensures the MCP process is spawned and killed
for each request, with guaranteed cleanup even on errors.

---

## MCP Protocol Flow

```
1. Next.js spawns: ./mcp-server (StdioClientTransport)
   stdin/stdout pipe established

2. Client sends:
   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}

3. Server responds:
   {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{...}}}

4. Client sends:
   {"jsonrpc":"2.0","id":2,"method":"tools/list"}

5. Server responds:
   {"jsonrpc":"2.0","id":2,"result":{"tools":[
     {"name":"get_current_time","description":"...","inputSchema":{...}},
     {"name":"calculate","description":"...","inputSchema":{...}},
     {"name":"get_weather_mock","description":"...","inputSchema":{...}}
   ]}}

6. AI model generates response, decides to call calculate:
   Client sends:
   {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"calculate","arguments":{"expression":"25*42"}}}

7. Server responds:
   {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"result\":1050,...}"}]}}

8. AI model receives result, continues generating natural language response.

9. Client closes — Rust process exits.
```

---

## Schema Validation Strategy

We validate at every trust boundary:

| Boundary | Schema | Why |
|----------|--------|-----|
| API route body | `ChatRequestSchema` | Never trust client input |
| User input (client) | `UserInputSchema` | Instant feedback, no round-trip |
| MCP tool schemas | `McpToolSchema` | Server may evolve independently |
| Tool results | `McpCallToolResultSchema` | Rust server could have bugs |

Schemas in `packages/shared` are used by both the server (API route) and
the client (ChatInput validation). One definition, two consumers, zero drift.

---

## Rust MCP Server Design

The server follows a simple dispatch pattern:

```rust
// mod.rs — the router
match tool_name {
    "get_current_time" => Ok(time::handle()),
    "calculate"        => calculate::handle(arguments),
    "get_weather_mock" => weather::handle(arguments),
    unknown            => Err(ErrorData::method_not_found()),
}
```

Each tool module is a pure function:
- No global state
- No I/O (except `chrono::Utc::now()` in time.rs)
- Returns `Result<CallToolResult, ErrorData>`

`evalexpr` provides a sandboxed math evaluator — it cannot execute
arbitrary code, only a grammar of arithmetic expressions.

---

## Streaming Architecture

```
streamText()                     ← Vercel AI SDK
  │ Returns StreamTextResult
  │
  └── .toDataStreamResponse()    ← converts to AI SDK stream format
        │ ReadableStream
        │ Content-Type: text/event-stream
        │
        ▼
    useChat() hook               ← Vercel AI SDK React
      │ Parses SSE chunks
      │ Updates messages[] in real time
      │ Handles tool_call / tool_result events
      │
      ▼
    MessageItem                  ← renders content + tool invocations
    ToolCallDisplay              ← shows args + result, expandable
```

The AI SDK handles the bidirectional tool-call flow automatically:
when the model returns a `tool_call` chunk, the SDK calls `execute()`,
sends the result back, and the model continues generating.

---

## Potential Improvements

### Performance
- **MCP connection pool**: Current design creates a new MCP process per request.
  Better: maintain a pool of persistent connections using `ManagedRuntime`.
- **Tool schema caching**: Cache the `listTools` result with a short TTL (e.g. 60s).
- **Response caching**: Cache identical tool invocations with matching args.

### Reliability
- **Retry logic**: Wrap `McpClientService.callTool` in `Effect.retry` with
  exponential backoff for transient failures.
- **Circuit breaker**: If the MCP server fails N times, stop spawning it and
  serve AI responses without tools.
- **Health check endpoint**: `GET /api/health` that verifies the MCP binary exists
  and responds to `tools/list`.

### Observability
- **OpenTelemetry**: Effect has built-in `Tracer` support. Add spans for each
  tool call with the tool name and latency.
- **Structured logging**: Use `Effect.log` throughout so logs carry correlation IDs.
- **Metrics**: Count tool invocations per type, latency histograms.

### Security
- **Input sanitisation**: The `calculate` tool uses `evalexpr` which is sandboxed,
  but validate expression length before evaluation.
- **Rate limiting**: Add `upstash/ratelimit` to the API route to prevent abuse.
- **Authentication**: Gate the `/api/chat` route behind a session check.

### Additional MCP Tool Ideas
- `search_docs(query)` — semantic search over documentation
- `run_sql(query)` — execute read-only SQL against a sandboxed database
- `get_github_issue(repo, number)` — fetch GitHub issue details
- `translate(text, target_language)` — call a translation API
- `generate_image_prompt(description)` — enhance a prompt for image generation
- `list_files(directory)` — list files in a sandboxed workspace
- `read_file(path)` — read file contents from a sandboxed workspace

---

## Key Files Reference

| File | Role |
|------|------|
| `apps/web/src/app/api/chat/route.ts` | Streaming API route, Effect orchestration |
| `apps/web/src/lib/effect/services/mcp-client.ts` | MCP connection service + Live/Mock layers |
| `apps/web/src/lib/effect/services/chat-service.ts` | Tool wiring + AI streaming |
| `apps/web/src/lib/effect/layers.ts` | Layer composition |
| `apps/web/src/lib/effect/errors.ts` | All typed error classes |
| `packages/shared/src/schemas/` | All Effect Schema definitions |
| `apps/mcp-server/src/tools/mod.rs` | MCP ServerHandler + tool dispatch |
| `apps/mcp-server/src/tools/calculate.rs` | Math expression evaluator |
| `apps/mcp-server/src/tools/weather.rs` | Mock weather tool |
| `apps/mcp-server/src/tools/time.rs` | Current time tool |
