/**
 * Tool: get_current_time
 *
 * Returns the current UTC time in both ISO-8601 and Unix timestamp formats.
 * This is intentionally simple — it exists to demonstrate the tool call flow
 * end-to-end without any external dependencies.
 */

use chrono::Utc;
use rmcp::model::CallToolResult;
use serde_json::json;

/// Build the tool result for get_current_time.
/// Returns a JSON object with both a human-readable and machine-readable time.
pub fn handle() -> CallToolResult {
    let now = Utc::now();

    let payload = json!({
        "iso8601": now.to_rfc3339(),
        "unix_timestamp": now.timestamp(),
        "unix_timestamp_ms": now.timestamp_millis(),
        "timezone": "UTC",
    });

    // Content is an array of items (the MCP spec allows mixed text/image/etc).
    // We use a single text item containing pretty-printed JSON.
    CallToolResult::success(vec![rmcp::model::Content::text(
        serde_json::to_string_pretty(&payload)
            .unwrap_or_else(|_| payload.to_string()),
    )])
}

/// JSON Schema describing this tool's input parameters.
/// get_current_time takes no arguments, so the schema is an empty object.
pub fn input_schema() -> serde_json::Map<String, serde_json::Value> {
    serde_json::from_value(json!({
        "type": "object",
        "properties": {},
        "required": []
    }))
    .expect("static schema is valid JSON")
}
