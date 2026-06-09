/**
 * Tool: get_weather_mock
 *
 * Returns realistic-looking mock weather data for a given city.
 * This is intentionally mock data to avoid requiring an API key in the demo.
 * In production you would call a real weather API (e.g. Open-Meteo, OpenWeather).
 *
 * The interesting part here is the structured JSON response — the AI model
 * receives this and can format it naturally for the user.
 */

use rmcp::model::{CallToolResult, Content, ErrorData};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

/// A tiny lookup table of cities → mock weather data.
fn mock_weather_db() -> HashMap<&'static str, Value> {
    let mut db = HashMap::new();

    db.insert(
        "london",
        json!({
            "city": "London",
            "country": "GB",
            "temperature_c": 14.2,
            "temperature_f": 57.6,
            "condition": "Partly Cloudy",
            "humidity_percent": 72,
            "wind_speed_kph": 18,
            "wind_direction": "SW",
            "visibility_km": 9,
            "uv_index": 3,
            "feels_like_c": 12.8,
            "description": "Typical London weather with occasional breaks in cloud cover."
        }),
    );
    db.insert(
        "new york",
        json!({
            "city": "New York",
            "country": "US",
            "temperature_c": 22.1,
            "temperature_f": 71.8,
            "condition": "Sunny",
            "humidity_percent": 55,
            "wind_speed_kph": 12,
            "wind_direction": "NE",
            "visibility_km": 16,
            "uv_index": 6,
            "feels_like_c": 21.5,
            "description": "Clear skies and comfortable temperatures in Manhattan."
        }),
    );
    db.insert(
        "tokyo",
        json!({
            "city": "Tokyo",
            "country": "JP",
            "temperature_c": 26.5,
            "temperature_f": 79.7,
            "condition": "Humid and Hazy",
            "humidity_percent": 85,
            "wind_speed_kph": 8,
            "wind_direction": "SE",
            "visibility_km": 7,
            "uv_index": 7,
            "feels_like_c": 30.2,
            "description": "Hot and humid with some haze. Typical summer conditions."
        }),
    );
    db.insert(
        "sydney",
        json!({
            "city": "Sydney",
            "country": "AU",
            "temperature_c": 18.3,
            "temperature_f": 64.9,
            "condition": "Clear",
            "humidity_percent": 62,
            "wind_speed_kph": 22,
            "wind_direction": "N",
            "visibility_km": 20,
            "uv_index": 8,
            "feels_like_c": 17.9,
            "description": "Beautiful clear day with a refreshing northerly breeze."
        }),
    );
    db.insert(
        "paris",
        json!({
            "city": "Paris",
            "country": "FR",
            "temperature_c": 16.8,
            "temperature_f": 62.2,
            "condition": "Overcast",
            "humidity_percent": 78,
            "wind_speed_kph": 15,
            "wind_direction": "W",
            "visibility_km": 8,
            "uv_index": 2,
            "feels_like_c": 15.5,
            "description": "Grey skies over the Seine. Rain expected later in the day."
        }),
    );
    db.insert(
        "dubai",
        json!({
            "city": "Dubai",
            "country": "AE",
            "temperature_c": 41.5,
            "temperature_f": 106.7,
            "condition": "Hot and Sunny",
            "humidity_percent": 40,
            "wind_speed_kph": 10,
            "wind_direction": "NW",
            "visibility_km": 12,
            "uv_index": 11,
            "feels_like_c": 45.0,
            "description": "Extreme heat. Stay hydrated and avoid prolonged outdoor exposure."
        }),
    );

    db
}

pub fn handle(arguments: Option<&Map<String, Value>>) -> Result<CallToolResult, ErrorData> {
    let city = arguments
        .and_then(|args| args.get("city"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            ErrorData::invalid_params(
                "Missing required argument: \"city\" (string)",
                None,
            )
        })?;

    let city_lower = city.to_lowercase();
    tracing::debug!("get_weather_mock: looking up city: {}", city_lower);

    let db = mock_weather_db();

    // Try exact match first, then prefix match for flexibility.
    let weather = db.get(city_lower.as_str()).or_else(|| {
        db.iter()
            .find(|(k, _)| k.starts_with(&city_lower[..city_lower.len().min(4)]))
            .map(|(_, v)| v)
    });

    match weather {
        Some(data) => {
            let payload = json!({
                "source": "mock_data",
                "note": "This is simulated weather data for demonstration purposes.",
                "weather": data
            });

            Ok(CallToolResult::success(vec![Content::text(
                serde_json::to_string_pretty(&payload)
                    .unwrap_or_else(|_| payload.to_string()),
            )]))
        }
        None => {
            // City not found — return a useful error the AI can relay to the user.
            let known_cities: Vec<&str> = db.keys().copied().collect();
            let payload = json!({
                "error": format!("City '{}' not found in mock database", city),
                "available_cities": known_cities,
                "note": "This is a mock server. Only a small set of cities are available."
            });

            Ok(CallToolResult {
                content: vec![Content::text(
                    serde_json::to_string_pretty(&payload)
                        .unwrap_or_else(|_| payload.to_string()),
                )],
                is_error: Some(true),
            })
        }
    }
}

pub fn input_schema() -> Map<String, Value> {
    serde_json::from_value(json!({
        "type": "object",
        "properties": {
            "city": {
                "type": "string",
                "description": "City name to get weather for, e.g. \"London\", \"Tokyo\", \"New York\""
            }
        },
        "required": ["city"]
    }))
    .expect("static schema is valid JSON")
}
