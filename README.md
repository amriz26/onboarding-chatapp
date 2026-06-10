# Effect MCP Chat

A production-quality monorepo starter that demonstrates:

- **Effect TS** — typed errors, Layers, Schema, dependency injection
- **Next.js 15** — App Router, Server Components, streaming API routes
- **Rust MCP Server** — three tools served via the Model Context Protocol
- **Claude 3.5** — AI with real tool use, streamed to the browser
- **shadcn/ui** — accessible, dark-mode-ready component library

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| Rust + Cargo | ≥ 1.80 |
| Anthropic API Key | any |

### 1. Clone and install

```bash
git clone <repo>
cd effect-mcp-chat
pnpm install
```

### 2. Build the Rust MCP server

```bash
pnpm build:mcp
# builds: apps/mcp-server/target/release/mcp-server
```

### 3. Configure environment

```bash
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local:
#   ANTHROPIC_API_KEY=sk-ant-...
#   MCP_SERVER_PATH=/absolute/path/to/apps/mcp-server/target/release/mcp-server
```

### 4. Run the dev server

```bash
pnpm dev
# → http://localhost:3000
```

---

## Monorepo Structure

```
effect-mcp-chat/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   └── src/
│   │       ├── app/         # Next.js App Router pages + API routes
│   │       ├── components/  # React components (chat UI, shadcn/ui)
│   │       └── lib/
│   │           ├── effect/  # Effect services, Layers, errors, runtime
│   │           └── schemas/ # Re-exports shared schemas
│   │
│   └── mcp-server/          # Rust MCP server (stdio transport)
│       └── src/
│           ├── main.rs      # Entry point
│           └── tools/       # Tool implementations + mod.rs dispatcher
│
└── packages/
    └── shared/              # Shared Effect Schema definitions
        └── src/schemas/     # chat.ts · tool.ts · mcp.ts
```

---

## How It Works

```
Browser
  │
  │ POST /api/chat (messages[])
  ▼
Next.js API Route (/api/chat/route.ts)
  │
  │ Effect program:
  │   1. Schema.decodeUnknown(ChatRequestSchema) — validate request
  │   2. ChatService.streamChat(messages) — orchestrate AI + MCP
  │      │
  │      ├── McpClientService.listTools() — discover tools from Rust server
  │      ├── Convert MCP tools → AI SDK tool definitions
  │      └── streamText(claude, messages, tools) — stream AI response
  │
  │ stream.toDataStreamResponse() — SSE stream
  ▼
Browser
  │ useChat() hook — receives chunks, updates message state
  ▼
React UI — renders messages + tool call cards in real time
```

The Rust MCP server runs as a child process started by the Next.js server.
Communication uses the MCP stdio transport (JSON-RPC 2.0 over stdin/stdout).

---

## MCP Tools

| Tool | Description | Try asking |
|------|-------------|------------|
| `get_current_time` | Current UTC time + Unix timestamp | "What time is it?" |
| `calculate` | Arithmetic expression evaluator | "What is sqrt(144) + 8?" |
| `get_weather_mock` | Mock weather by city | "What's the weather in Tokyo?" |

---

## Effect TS Patterns Demonstrated

| Pattern | File | Purpose |
|---------|------|---------|
| `Data.TaggedError` | `lib/effect/errors.ts` | Typed error types with discriminant tags |
| `Context.Tag` | `lib/effect/services/*.ts` | Service tokens for dependency injection |
| `Layer.scoped` | `lib/effect/services/mcp-client.ts` | Resource management (connect/disconnect MCP) |
| `Effect.gen` | `lib/effect/services/chat-service.ts` | Generator-based async orchestration |
| `Schema.decodeUnknown` | `app/api/chat/route.ts` | Runtime boundary validation |
| `Layer.provide` | `lib/effect/layers.ts` | Layer composition / wiring |
| `Effect.acquireRelease` | `lib/effect/services/mcp-client.ts` | Guaranteed cleanup |

---

## Switching to the Mock MCP Client

If you have not built the Rust binary yet, the app automatically falls back
to an in-memory mock client when `MCP_SERVER_PATH` is not set.

To force the mock even when the path is set, edit `lib/effect/layers.ts`:

```ts
// Change:
const McpLayer = process.env.MCP_SERVER_PATH ? McpClientLive : McpClientMock
// To:
const McpLayer = McpClientMock
```

---

## Production Hardening (see ARCHITECTURE.md for details)

- [ ] Add a persistent MCP connection pool (instead of per-request connections)
- [ ] Add OpenTelemetry tracing with Effect's built-in `Tracer`
- [ ] Add rate limiting at the API route level
- [ ] Persist conversation history to a database (PostgreSQL + Drizzle)
- [ ] Add authentication (NextAuth / Clerk)
- [ ] Containerise the Rust binary in a Docker image
