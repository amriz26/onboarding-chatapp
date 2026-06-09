/**
 * McpToolServer — implements the ServerHandler trait for the rmcp SDK.
 *
 * WHY A SEPARATE mod.rs?
 * This file is the central dispatch layer. The individual tool files (time.rs,
 * calculate.rs, weather.rs) are pure functions — they don't know about MCP.
 * This module wires them into the MCP protocol layer, keeping tool logic
 * decoupled from protocol handling.
 *
 * Adding a new tool means:
 *   1. Create a new file in tools/
 *   2. Add it to the `tools/list` response in `list_tools`
 *   3. Add a dispatch arm in `call_tool`
 * Nothing else needs to change.
 */

pub mod calculate;
pub mod time;
pub mod weather;

use anyhow::Result;
use rmcp::{
    model::{
        CallToolRequestParam, CallToolResult, ErrorData, InitializeRequestParam,
        InitializeResult, ListToolsResult, ProtocolVersion, ServerCapabilities, ServerInfo, Tool,
    },
    service::RequestContext,
    RoleServer, ServerHandler,
};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct McpToolServer;

impl McpToolServer {
    pub fn new() -> Self {
        Self
    }
}

impl ServerHandler for McpToolServer {
    /// Server metadata returned during the MCP handshake.
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::LATEST,
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .build(),
            server_info: rmcp::model::Implementation {
                name: "effect-mcp-demo".to_string(),
                version: "0.1.0".to_string(),
            },
            instructions: Some(
                "Tool server exposing get_current_time, calculate, and get_weather_mock."
                    .to_string(),
            ),
        }
    }

    /// Called by the MCP client to discover available tools.
    ///
    /// Each Tool contains:
    ///   - name: used as the identifier when calling the tool
    ///   - description: shown to the AI model so it knows when to use the tool
    ///   - input_schema: JSON Schema that validates the tool's arguments
    async fn list_tools(
        &self,
        _request: Option<rmcp::model::PaginatedRequestParam>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        let tools = vec![
            Tool {
                name: "get_current_time".into(),
                description: Some(
                    "Returns the current UTC time as an ISO-8601 string and Unix timestamp. \
                     Use this when the user asks what time it is."
                        .into(),
                ),
                input_schema: Arc::new(time::input_schema()),
            },
            Tool {
                name: "calculate".into(),
                description: Some(
                    "Evaluates an arithmetic expression and returns the numeric result. \
                     Supports +, -, *, /, ^, sqrt(), abs(), sin(), cos(), floor(), ceil(). \
                     Use this when the user asks you to compute a math expression."
                        .into(),
                ),
                input_schema: Arc::new(calculate::input_schema()),
            },
            Tool {
                name: "get_weather_mock".into(),
                description: Some(
                    "Returns current weather conditions for a city (mock data for demo). \
                     Returns temperature, humidity, wind, and a description. \
                     Use this when the user asks about the weather in a specific city."
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

    /// Called by the MCP client when the AI model wants to invoke a tool.
    async fn call_tool(
        &self,
        request: CallToolRequestParam,
        _context: RequestContext<RoleServer>,
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
