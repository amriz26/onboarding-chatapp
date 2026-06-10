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
 *   - The binary is spawned on demand by the Next.js server — no daemon needed.
 *   - Rust's ownership model ensures memory safety in the tool handlers.
 *
 * WHY STDIO TRANSPORT?
 *   MCP supports both stdio and HTTP-SSE transports.
 *   Stdio is simplest: the parent process owns the lifecycle, no ports to
 *   manage, and the tool server is naturally sandboxed.
 */

mod tools;

use anyhow::Result;
// ServiceExt provides the .serve() method on any ServerHandler implementor.
use rmcp::{transport::stdio, ServiceExt};
use tools::McpToolServer;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> Result<()> {
    // MCP uses stdout for JSON-RPC, so logs MUST go to stderr.
    // Writing anything else to stdout would corrupt the protocol stream.
    fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    tracing::info!("MCP tool server starting (stdio transport)");

    let server = McpToolServer::new();

    // stdio() creates a paired (stdin → read, stdout → write) transport.
    // serve() drives the JSON-RPC request/response loop until EOF / shutdown.
    server.serve(stdio()).await?;

    tracing::info!("MCP tool server exiting");
    Ok(())
}
