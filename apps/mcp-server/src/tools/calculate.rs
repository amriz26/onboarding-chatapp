/**
 * Tool: calculate
 *
 * Evaluates a safe arithmetic expression and returns the result.
 *
 * Supported: + - * / % ^ () and functions like sqrt(), sin(), cos(),
 * abs(), floor(), ceil(), round(), min(), max(), ln(), log2(), exp().
 *
 * evalexpr is a sandboxed evaluator — it cannot execute arbitrary code.
 * Only a well-defined grammar of math expressions is supported.
 *
 * Examples:
 *   "2 + 2"             → 4
 *   "sqrt(144)"         → 12
 *   "25 * 42"           → 1050
 *   "(100 / 4) + 3.5"  → 28.5
 */

use evalexpr::eval_number;
use rmcp::model::{Annotated, CallToolResult, ErrorData, RawContent};
use serde_json::{json, Map, Value};

pub fn handle(arguments: Option<&Map<String, Value>>) -> Result<CallToolResult, ErrorData> {
    let expression = arguments
        .and_then(|args| args.get("expression"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            ErrorData::invalid_params(
                "Missing required argument: \"expression\" (string)",
                None,
            )
        })?;

    tracing::debug!("calculate: evaluating \"{}\"", expression);

    match eval_number(expression) {
        Ok(result) => {
            let payload = json!({
                "expression": expression,
                "result": result,
                "formatted": format!("{} = {}", expression, result),
            });

            let text = serde_json::to_string_pretty(&payload)
                .unwrap_or_else(|_| payload.to_string());

            Ok(CallToolResult {
                content: vec![Annotated {
                    raw: RawContent::Text { text },
                    annotations: None,
                }],
                is_error: Some(false),
            })
        }
        Err(e) => {
            // Return an isError:true result so the AI model can see what went
            // wrong and potentially suggest a corrected expression.
            let payload = json!({
                "expression": expression,
                "error": e.to_string(),
                "hint": "Supported: +, -, *, /, ^, sqrt(), abs(), sin(), cos(), ln(), log2()"
            });

            let text = serde_json::to_string_pretty(&payload)
                .unwrap_or_else(|_| payload.to_string());

            Ok(CallToolResult {
                content: vec![Annotated {
                    raw: RawContent::Text { text },
                    annotations: None,
                }],
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
