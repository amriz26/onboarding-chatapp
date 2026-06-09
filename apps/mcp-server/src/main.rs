/**
 * MCP Server — entry point
 *
 * HOW MCP WORKS (high level):
 *   1. The AI application (Next.js) spawns this binary as a child process.
 *   2. Communication happens over stdio using JSON-RPC 2.0.
 *   3. The client sends `initialize`, then `tools/list`, then `tools/call`.
 *   4. We respond with structured JSON at each step.
 *
 * WHY RUST?
 *   - Rust produces a single static binary with zero runtime dependencies.
 *   - The MCP server can be shipped alongside the Next.js app and started on demand.
 *   - Rust's type system and ownership model make it excellent for correct,
 *     safe tool implementations.
 *
 * WHY STDIO TRANSPORT?
 *   MCP supports both stdio (stdin/stdout) and HTTP-SSE transports.
 *   Stdio is the simplest: the parent process owns the lifecycle, no ports to
 *   manage, and it is naturally sandboxed — the tool server can only
 *   communicate through the pipe, not make arbitrary network requests.
 */

mod tools;

use anyhow::Result;
use rmcp::{transport::stdio, ServiceExt};
use tools::McpToolServer;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> Result<()> {
    // MCP uses stdout for the JSON-RPC protocol, so we MUST send logs to
    // stderr. If we accidentally wrote tracing output to stdout it would
    // corrupt the protocol stream.
    fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    tracing::info!("MCP tool server starting (stdio transport)");

    let server = McpToolServer::new();

    // `stdio()` creates a paired (stdin, stdout) transport.
    // `serve` drives the JSON-RPC loop until EOF / shutdown.
    server.serve(stdio()).await?;

    tracing::info!("MCP tool server exiting");
    Ok(())
}
