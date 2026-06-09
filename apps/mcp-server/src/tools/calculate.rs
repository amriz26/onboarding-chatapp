/**
 * Tool: calculate
 *
 * Evaluates a safe arithmetic expression and returns the result.
 *
 * Supported operations: + - * / % ^ () and standard functions like
 * sqrt(), sin(), cos(), abs(), floor(), ceil(), round(), min(), max().
 *
 * The `evalexpr` crate is a sandboxed evaluator — it does NOT execute
 * arbitrary code, only a well-defined grammar of math expressions. This
 * makes it safe to expose as a public tool.
 *
 * Examples:
 *   "2 + 2"             → 4
 *   "sqrt(144)"         → 12
 *   "25 * 42"           → 1050
 *   "(100 / 4) + 3.5"  → 28.5
 */

use evalexpr::{eval_number_with_context, HashMapContext};
use rmcp::model::{CallToolResult, Content, ErrorData};
use serde_json::{json, Map, Value};

pub fn handle(arguments: Option<&Map<String, Value>>) -> Result<CallToolResult, ErrorData> {
    // Extract the expression string from the tool arguments.
    let expression = arguments
        .and_then(|args| args.get("expression"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            ErrorData::invalid_params(
                "Missing required argument: \"expression\" (string)",
                None,
            )
        })?;

    tracing::debug!("calculate: evaluating expression: {}", expression);

    // Evaluate — evalexpr works in a sandboxed context with no side effects.
    let ctx = HashMapContext::new();
    match eval_number_with_context(expression, &ctx) {
        Ok(result) => {
            let payload = json!({
                "expression": expression,
                "result": result,
                // Provide a friendly string for display in the chat UI
                "formatted": format!("{} = {}", expression, result),
            });

            Ok(CallToolResult::success(vec![Content::text(
                serde_json::to_string_pretty(&payload)
                    .unwrap_or_else(|_| payload.to_string()),
            )]))
        }
        Err(e) => {
            // The expression was malformed or contained an unsupported operation.
            // We return an MCP "isError: true" result rather than a JSON-RPC error
            // so the AI model can see the error message and potentially retry.
            let payload = json!({
                "expression": expression,
                "error": e.to_string(),
                "hint": "Use standard arithmetic: +, -, *, /, ^, sqrt(), abs(), sin(), cos()"
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
            "expression": {
                "type": "string",
                "description": "Arithmetic expression to evaluate, e.g. \"25 * 42\" or \"sqrt(144)\""
            }
        },
        "required": ["expression"]
    }))
    .expect("static schema is valid JSON")
}
