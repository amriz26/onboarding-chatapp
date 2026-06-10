/**
 * McpToolServer — implements the rmcp ServerHandler trait.
 *
 * This is the central dispatch layer. Individual tool modules are pure
 * functions; this module wires them into the MCP protocol.
 *
 * Adding a new tool:
 *   1. Create tools/<name>.rs with handle() and input_schema()
 *   2. Declare it as `pub mod <name>;` below
 *   3. Add a Tool entry in list_tools()
 *   4. Add a match arm in call_tool()
 */

pub mod calculate;
pub mod time;
pub mod weather;

use rmcp::{
    model::{
        CallToolRequestParam, CallToolResult, ErrorData, InitializeRequestParam,
        InitializeResult, ListToolsResult, ServerCapabilities, ServerInfo, Tool,
    },
    service::RequestContext,
    ServerHandler,
};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct McpToolServer;

impl McpToolServer {
    pub fn new() -> Self {
        Self
    }
}

impl Default for McpToolServer {
    fn default() -> Self {
        Self::new()
    }
}

impl ServerHandler for McpToolServer {
    /// Metadata returned during the MCP initialize handshake.
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            name: "effect-mcp-demo".to_string(),
            version: "0.1.0".to_string(),
        }
    }

    /// Called by the MCP client to discover available tools.
    async fn list_tools(
        &self,
        _request: Option<rmcp::model::PaginatedRequestParam>,
        _context: RequestContext<rmcp::RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        let tools = vec![
            Tool {
                name: "get_current_time".into(),
                description: Some(
                    "Returns the current UTC time as ISO-8601 and Unix timestamp. \
                     Use this when the user asks what time it is."
                        .into(),
                ),
                input_schema: Arc::new(time::input_schema()),
            },
            Tool {
                name: "calculate".into(),
                description: Some(
                    "Evaluates an arithmetic expression and returns the numeric result. \
                     Supports +, -, *, /, ^, sqrt(), abs(), sin(), cos(), floor(), ceil(), ln(). \
                     Use when the user asks you to compute a math expression."
                        .into(),
                ),
                input_schema: Arc::new(calculate::input_schema()),
            },
            Tool {
                name: "get_weather_mock".into(),
                description: Some(
                    "Returns current weather conditions for a city (mock data). \
                     Returns temperature, humidity, wind speed, and a description. \
                     Use when the user asks about the weather in a specific city."
                        .into(),
                ),
                input_schema: Arc::new(weather::input_schema()),
            },
        ];

        tracing::info!("tools/list: returning {} tools", tools.len());

        Ok(ListToolsResult {
            tools,
            next_cursor: None,
        })
    }

    /// Called when the AI model wants to invoke a tool.
    async fn call_tool(
        &self,
        request: CallToolRequestParam,
        _context: RequestContext<rmcp::RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let tool_name = request.name.as_ref();
        let arguments = request.arguments.as_ref();

        tracing::info!("tools/call: {}", tool_name);

        match tool_name {
            "get_current_time" => Ok(time::handle()),
            "calculate" => calculate::handle(arguments),
            "get_weather_mock" => weather::handle(arguments),
            unknown => {
                tracing::warn!("tools/call: unknown tool: {}", unknown);
                Err(ErrorData::method_not_found::<()>())
            }
        }
    }
}
