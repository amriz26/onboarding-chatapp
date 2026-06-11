import { jsonSchema, tool, type ToolSet } from "ai"
import { Effect } from "effect"
import type { McpTool } from "@effect-mcp/shared"
import type { McpToolCallError } from "@/lib/effect/errors"

// The shape of MCPService.callTool — passed in to keep this module free of
// any direct service import (avoids a circular dependency chain).
type CallToolFn = (
  name: string,
  args: Record<string, unknown>,
) => Effect.Effect<Array<{ type: string; text?: string }>, McpToolCallError>

/**
 * Convert an array of MCP tool definitions into an AI SDK ToolSet.
 *
 * Tool schemas come from the MCP server (Railway). Tool execution runs here
 * on Vercel, not on Railway, because Railway's container network cannot reach
 * external HTTP APIs (Open-Meteo, etc.) due to network restrictions.
 *
 * - get_weather_mock: fetches Open-Meteo directly from Vercel
 * - all other tools: forwarded to the Railway MCP server via callTool
 */
export function mcpToolsToAiTools(
  mcpTools: readonly McpTool[],
  callTool: CallToolFn,
): ToolSet {
  const aiTools: ToolSet = {}

  for (const mcpTool of mcpTools) {
    const toolName = mcpTool.name

    aiTools[toolName] = tool({
      description: mcpTool.description ?? `MCP tool: ${toolName}`,
      parameters: jsonSchema(
        mcpTool.inputSchema as Parameters<typeof jsonSchema>[0],
      ),
      execute:
        toolName === "get_weather_mock"
          ? async (args: unknown) =>
              fetchWeather((args as { city?: string })?.city ?? "")
          : (args: unknown) =>
              Effect.runPromise(
                callTool(toolName, args as Record<string, unknown>).pipe(
                  Effect.map((content) =>
                    content
                      .filter((c): c is { type: "text"; text: string } =>
                        c.type === "text" && typeof c.text === "string",
                      )
                      .map((c) => c.text)
                      .join("\n"),
                  ),
                  Effect.orElseSucceed(
                    () => `Tool "${toolName}" returned an error or empty result`,
                  ),
                ),
              ),
    }) as ToolSet[string]
  }

  return aiTools
}

// ---------------------------------------------------------------------------
// Weather — fetched from Vercel, not Railway, to avoid Railway egress limits
// ---------------------------------------------------------------------------

async function fetchWeather(city: string): Promise<string> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!geoRes.ok) throw new Error(`Geocoding HTTP ${geoRes.status}`)
    const geo = (await geoRes.json()) as {
      results?: Array<{
        name: string
        country: string
        latitude: number
        longitude: number
      }>
    }
    if (!geo.results?.length) return `City "${city}" not found.`
    const { latitude, longitude, name, country } = geo.results[0]

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,` +
        `weather_code,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover` +
        `&wind_speed_unit=kmh&timezone=auto`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!weatherRes.ok) throw new Error(`Weather API HTTP ${weatherRes.status}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wd = (await weatherRes.json()) as any
    const c = wd.current

    return JSON.stringify({
      city: name,
      country,
      temperature_c: c.temperature_2m,
      feels_like_c: c.apparent_temperature,
      humidity_percent: c.relative_humidity_2m,
      condition: wmoDescription(c.weather_code),
      wind_speed_kph: c.wind_speed_10m,
      precipitation_mm: c.precipitation,
      cloud_cover_percent: c.cloud_cover,
      source: "open-meteo.com",
    })
  } catch (err) {
    return `Weather fetch failed for "${city}": ${String(err)}`
  }
}

function wmoDescription(code: number): string {
  if (code === 0) return "Clear sky"
  if (code === 1) return "Mainly clear"
  if (code === 2) return "Partly cloudy"
  if (code === 3) return "Overcast"
  if (code === 45 || code === 48) return "Fog"
  if (code >= 51 && code <= 57) return "Drizzle"
  if (code >= 61 && code <= 67) return "Rain"
  if (code >= 71 && code <= 77) return "Snow"
  if (code >= 80 && code <= 82) return "Rain showers"
  if (code >= 85 && code <= 86) return "Snow showers"
  if (code === 95) return "Thunderstorm"
  if (code >= 96) return "Thunderstorm with hail"
  return `Weather code ${code}`
}
