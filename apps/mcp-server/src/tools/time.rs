/**
 * Tool: get_current_time
 *
 * Returns the current UTC time in both ISO-8601 and Unix timestamp formats.
 */

use chrono::Utc;
use rmcp::model::{Annotated, CallToolResult, RawContent};
use serde_json::json;

/// Build the tool result for get_current_time.
pub fn handle() -> CallToolResult {
    let now = Utc::now();

    let payload = json!({
        "iso8601": now.to_rfc3339(),
        "unix_timestamp": now.timestamp(),
        "unix_timestamp_ms": now.timestamp_millis(),
        "timezone": "UTC",
    });

    let text = serde_json::to_string_pretty(&payload).unwrap_or_else(|_| payload.to_string());

    CallToolResult {
        content: vec![Annotated {
            raw: RawContent::Text { text },
            annotations: None,
        }],
        is_error: Some(false),
    }
}

/// JSON Schema for this tool's input. get_current_time takes no arguments.
pub fn input_schema() -> serde_json::Map<String, serde_json::Value> {
    serde_json::from_value(json!({
        "type": "object",
        "properties": {},
        "required": []
    }))
    .expect("static schema is valid JSON")
}
