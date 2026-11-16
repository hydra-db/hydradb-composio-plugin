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

## API version

Both operations require the `API-Version: 2` request header. Supply it explicitly
when executing the imported tools; it is a header parameter, not a body field.
The OpenAPI contract allows only `2` and deliberately has no header default.
It does not configure automatic static-header injection in Composio.

After importing, verify that your importer exposes and forwards this required
header. Hosted Composio importer behavior has not been verified here. A schema
declaration alone is not proof that a hosted importer injects the header.
Composio's [proxy request documentation](https://docs.composio.dev/reference/api-reference/tools/postToolsExecuteProxy)
documents explicit provider-header parameters, but this repository does not
change the existing importer or authentication setup to use that separate API.

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

## Offline contract tests

With Node.js 22 or later:

```sh
npm ci --ignore-scripts
npm test
```

The tests execute the real Swagger Client request builder with a mock fetch,
inspect serialized headers and multipart/JSON bodies, and verify that omitting
the required version is rejected. They preserve the query selector's knowledge
default and explicit knowledge/memory choices. No credentials or network calls
are used by the tests; these checks do not certify the hosted Composio importer.
