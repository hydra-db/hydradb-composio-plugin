<p align="center"><img src="assets/icon.png" width="96" alt="HydraDB" /></p>

# HydraDB for Composio

A [Composio](https://composio.dev) custom app for [HydraDB](https://hydradb.com),
exposing HydraDB as agent-callable tools.

## Tools

| Tool | Endpoint | What it does |
|------|----------|--------------|
| `recall_context`   | `POST /query`          | Recall relevant context for a query. |
| `ingest_knowledge` | `POST /context/ingest` | Store a note as knowledge. |

## Authentication

`BEARER_TOKEN` - the HydraDB API key, sent as a Bearer token.

## Files

- `openapi.yaml` - the OpenAPI spec Composio generates the tools from.
- `integrations.yaml` - app metadata and the bearer auth scheme.

## Setup

1. In the Composio dashboard (or via the SDK), add a custom app and import
   `openapi.yaml`.
2. Configure the bearer auth using `integrations.yaml`.
3. Connect an account with your HydraDB API key.

The two tools are then available to agents through a Composio session.

## Notes

The database (tenant) is carried in each request body, so a single app works
across databases. For the full HydraDB tool set, register the HydraDB MCP server
(`mcp.hydradb.com`) as a Composio Custom MCP connector instead of this app.
