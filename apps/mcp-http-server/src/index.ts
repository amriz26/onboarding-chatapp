import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import express from "express"
import { randomUUID } from "node:crypto"

// ---------------------------------------------------------------------------
// Tool implementations — real data, no mocks
// ---------------------------------------------------------------------------

function toolCurrentTime() {
  const now = new Date()
  return JSON.stringify({
    utc: now.toISOString(),
    unix: Math.floor(now.getTime() / 1000),
    formatted: now.toUTCString(),
  })
}

function toolCalculate(expression: string): { text: string; isError?: boolean } {
  // Restrict to safe math characters before calling Function()
  if (!/^[\d\s+\-*/().^%,a-zA-Z_]+$/.test(expression)) {
    return { text: JSON.stringify({ error: "Invalid expression: only math characters allowed" }), isError: true }
  }
  const math = {
    sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos,
    tan: Math.tan, floor: Math.floor, ceil: Math.ceil, round: Math.round,
    ln: Math.log, log: Math.log10, pi: Math.PI, e: Math.E,
  }
  try {
    const jsExpr = expression.replace(/\^/g, "**")
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(math), `"use strict"; return (${jsExpr})`)
    const result = fn(...Object.values(math))
    return { text: JSON.stringify({ expression, result }) }
  } catch (err) {
    return { text: JSON.stringify({ error: String(err) }), isError: true }
  }
}

async function toolWeather(city: string): Promise<{ text: string; isError?: boolean }> {
  try {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error(`wttr.in responded with HTTP ${res.status}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    const c = data.current_condition[0]
    const area = data.nearest_area?.[0]
    return {
      text: JSON.stringify({
        city: area?.areaName?.[0]?.value ?? city,
        country: area?.country?.[0]?.value ?? "",
        temperature_c: Number(c.temp_C),
        temperature_f: Number(c.temp_F),
        condition: c.weatherDesc[0].value,
        humidity_percent: Number(c.humidity),
        feels_like_c: Number(c.FeelsLikeC),
        wind_speed_kph: Number(c.windspeedKmph),
        wind_direction: c.winddir16Point,
        visibility_km: Number(c.visibility),
        uv_index: Number(c.uvIndex),
        source: "wttr.in",
      }),
    }
  } catch (err) {
    return {
      text: JSON.stringify({ error: `Could not fetch weather for "${city}": ${String(err)}` }),
      isError: true,
    }
  }
}

// ---------------------------------------------------------------------------
// MCP server factory — one instance per session
// ---------------------------------------------------------------------------

function createServer(): Server {
  const server = new Server(
    { name: "mcp-tools", version: "1.0.0" },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_current_time",
        description: "Returns the current UTC time as ISO-8601 and Unix timestamp.",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "calculate",
        description:
          "Evaluates an arithmetic expression. Supports +, -, *, /, ^, sqrt(), abs(), " +
          "sin(), cos(), tan(), floor(), ceil(), round(), ln(), log(), pi, e.",
        inputSchema: {
          type: "object",
          properties: { expression: { type: "string", description: "Math expression to evaluate" } },
          required: ["expression"],
        },
      },
      {
        name: "get_weather_mock",
        description: "Returns real current weather for any city via wttr.in.",
        inputSchema: {
          type: "object",
          properties: { city: { type: "string", description: "City name, e.g. 'London'" } },
          required: ["city"],
        },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params

    switch (name) {
      case "get_current_time": {
        const text = toolCurrentTime()
        return { content: [{ type: "text", text }] }
      }
      case "calculate": {
        const expression = (args?.expression ?? "") as string
        const { text, isError } = toolCalculate(expression)
        return { content: [{ type: "text", text }], isError }
      }
      case "get_weather_mock": {
        const city = (args?.city ?? "") as string
        const { text, isError } = await toolWeather(city)
        return { content: [{ type: "text", text }], isError }
      }
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  })

  return server
}

// ---------------------------------------------------------------------------
// HTTP server with session management
// ---------------------------------------------------------------------------

const sessions = new Map<string, StreamableHTTPServerTransport>()

const app = express()
app.use(express.json())

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined

  let transport: StreamableHTTPServerTransport

  if (sessionId && sessions.has(sessionId)) {
    transport = sessions.get(sessionId)!
  } else {
    const id = randomUUID()
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => id })
    sessions.set(id, transport)

    const mcpServer = createServer()
    await mcpServer.connect(transport)

    transport.onclose = () => sessions.delete(id)

    // Expire idle sessions after 10 minutes
    setTimeout(() => {
      if (sessions.has(id)) {
        transport.close()
        sessions.delete(id)
      }
    }, 10 * 60 * 1000)
  }

  await transport.handleRequest(req, res, req.body)
})

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: "Session not found" })
    return
  }
  await sessions.get(sessionId)!.handleRequest(req, res)
})

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined
  if (sessionId && sessions.has(sessionId)) {
    const t = sessions.get(sessionId)!
    await t.handleRequest(req, res)
    sessions.delete(sessionId)
  } else {
    res.status(200).end()
  }
})

app.get("/health", (_req, res) => {
  res.json({ status: "ok", activeSessions: sessions.size })
})

const PORT = parseInt(process.env.PORT ?? "8080", 10)
app.listen(PORT, () => {
  console.log(`MCP HTTP server listening on port ${PORT}`)
})
