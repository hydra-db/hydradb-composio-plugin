# Unified rollout preparation

**DO NOT MERGE — Unified API is not enabled in production; hold until production rollout is confirmed.**

This is an unpublished-contract preview, not a production API sync. Do not
publish, import, deploy, or enable it before rollout is confirmed. Existing
split operations and API-Version 2 remain the default. A failed write is never
retried with another layout.

## Contract provenance

The response fixture is handwritten from `flag-on.json` at application commit
`5d45c23840a62fcf38ff13e8deea5587ab1b961c`:
SHA-256 `34972cc67f1cc20b32371a4365f3fe69980f06e52c8559ad4e805e1c1d58feba`.
The same-source `flag-off.json` baseline has SHA-256
`418f71fbf02fd8e319b69ece7e143842ef2c45ff36b4a2deb1fa4d76e2171320`.

Query response schemas are `search.QueryResult` and `search.QueryChunk`.
The preview SDK JSON does **not** declare JSON context ingestion: its ingest
request exposes multipart only. The JSON write contract instead comes from
`application/internal/domain/memories/unified_ingest.go` and
`application/internal/api/handler/{context_ingest_route.go,type_rule_matrix_test.go,unified_defaults_test.go}`
at that commit. Response behavior is implemented in
`application/internal/domain/search/unified_response.go`.
No generated SDK or Nango models are checked in or modified here.
Published `@hydradb/sdk@2.1.8` has no typed unified declarations; this preview
uses raw transport rather than inventing an SDK version. Site publication is
independently blocked by the source's documentation lint failures.

## Unified writes

Unified ingestion sends JSON `{database, collection, context: [...]}`, never
split `type`/`kind`, `app_knowledge`, or `memories`. Each context has nonblank
`text` XOR a nonempty `conversation: [{role, content}]`; roles are `user`,
`assistant`, or `system`, with at least one user/assistant turn.

Optional context fields are `context_id`, `title`, `user_name`, `attributes`,
`custom_attributes`, `happened_at` (YYYY-MM-DD), `enrich`, `instructions`,
`upsert`, `forceful_relations: {context_ids, properties}`, and `acl`.
False, zero, empty strings and an explicitly empty ACL are not defaulted away.
Unknown item/turn/relation keys are rejected, including removed
`context_category` and split `metadata`/`additional_metadata`.
The specification declares structural constraints. The server remains
authoritative for UTF-8 budgets, identifiers, metadata policy, ACL principal
normalization and asynchronous acceptance. A 202 means queued, not indexed.

## Unified reads

Read shape is independent of the selected write layout. Unified `chunk_id`
becomes the host record's `id`, `content` becomes `text` verbatim, and
`context_id`, score, enrichment, receipt time, optional temporal facts and CSV
row ranges remain separate. JSON-looking content is literal, not a split
content envelope. Source title/metadata are not invented or fetched.
Root `graph[]`, `forceful_relations[]`, `llm_prompt` and `tabular_data` are
preserved. Pass `llm_prompt` verbatim to a downstream model; do not trim,
unwrap, reconstruct or concatenate it with chunk prose.

## Composio interface and verification

`openapi.yaml` remains the existing split specification, unchanged. The new
handwritten `openapi-unified.yaml` is a separate unified-only specification;
choosing it is the explicit layout choice. Do not import either spec as part
of this preparation. The existing production selector/version-header fix
stack and tabular-sync PR remain untouched.

The preview defines only `recall_context` and `ingest_context`. Recall returns
the full envelope instead of projecting chunk records, so chunkless roots are
preserved. Ingest takes the canonical context array directly. Both operations
require the caller to explicitly supply `API-Version: 2` and bearer auth; a
schema default is not treated as header injection. OpenAPI body validation
rejects unknown fields, but metadata/ACL and UTF-8 budget checks remain server
responsibilities. Swagger-client serialization alone is not body validation.

The pinned SDK query schema omits the lower bound on `max_results`, but runtime
`QueryRequest.Validate()` delegates to `RecallSearchRequest.Validate()` in
`application/internal/domain/search/models.go`, which rejects values below 1.
`models_test.go` explicitly covers "zero rejected". The handwritten schema keeps
`minimum: 1`; tests check both zero rejection and valid request serialization.

Run `npm ci --ignore-scripts` and `npm test`. Tests validate schemas with Ajv
and serialize source-spec requests using Swagger-client with a mocked fetch.
They do not prove Composio's importer behavior or call any live endpoint.
