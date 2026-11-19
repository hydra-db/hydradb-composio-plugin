const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const YAML = require('yaml');
const SwaggerClient = require('swagger-client');
const Ajv = require('ajv');
const spec = YAML.parse(fs.readFileSync('openapi-unified.yaml', 'utf8'));
const fixture = require('./unified-response.json');
globalThis.fetch = async () => { throw new Error('Network forbidden in offline tests'); };

async function execute(operationId, body, fail = false, parameters = { 'API-Version': '2' }) {
  const requests = [];
  const client = await new SwaggerClient({
    spec: structuredClone(spec), authorizations: { bearerAuth: { value: 'offline' } },
    userFetch: async (url, init) => {
      requests.push(new Request(url, init));
      return new Response(JSON.stringify(fail ? { error: 'rejected' } : fixture), { status: fail ? 400 : 200, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.deepEqual(client.errors, []);
  try { await client.apis.default[operationId](parameters, { requestBody: body }); }
  catch (error) { error.requests = requests; throw error; }
  return requests;
}

test('unified spec serializes exact JSON context with explicit auth/version and no split selector', async () => {
  const body = { database: 'db', collection: 'col', context: [{ text: 'literal', context_id: 'ctx', enrich: false, upsert: false, attributes: { n: 0 }, custom_attributes: { enabled: false }, acl: [] }] };
  const [request] = await execute('ingest_context', body);
  assert.equal(request.headers.get('API-Version'), '2');
  assert.equal(request.headers.get('Authorization'), 'Bearer offline');
  assert.match(request.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await request.json(), body);
  const [query] = await execute('recall_context', { database: 'db', query: 'q', max_results: 1 });
  assert.deepEqual(await query.json(), { database: 'db', query: 'q', max_results: 1 });
  await assert.rejects(execute('ingest_context', body, true), e => e.requests.length === 1);
  await assert.rejects(execute('ingest_context', body, false, {}), /Required parameter API-Version/);
});

test('strict schemas cover canonical text/conversation inputs, reject unknown keys and retain false values', async () => {
  const { spec: resolved, errors } = await SwaggerClient.resolve({ spec: structuredClone(spec) });
  assert.deepEqual(errors, []);
  const schema = resolved.paths['/context/ingest'].post.requestBody.content['application/json'].schema;
  const validate = new Ajv({ strict: false }).compile(schema);
  assert.equal(validate({ database: 'db', context: [{ conversation: [{ role: 'system', content: 'instructions' }, { role: 'user', content: 'hello' }], user_name: 'Ada', happened_at: '2026-10-01', title: 't', instructions: '', enrich: false, upsert: false, forceful_relations: { context_ids: ['other'], properties: { weight: 0 } }, acl: [] }] }), true, JSON.stringify(validate.errors));
  for (const item of [{ text: 'x', conversation: [{ role: 'user', content: 'y' }] }, { metadata: {}, text: 'x' }, { additional_metadata: {}, text: 'x' }, { context_category: 'note', text: 'x' }, { conversation: [{ role: 'user', content: 'x', name: 'bad' }] }, { conversation: [{ role: 'tool', content: 'x' }] }, {}]) {
    assert.equal(validate({ database: 'db', context: [item] }), false, JSON.stringify(item));
  }
  assert.equal(validate({ database: 'db', context: [], type: 'unified' }), false);
  const querySchema = resolved.paths['/query'].post.requestBody.content['application/json'].schema;
  const validateQuery = new Ajv({ strict: false }).compile(querySchema);
  assert.equal(validateQuery({ database: 'db', query: 'q', max_results: 0 }), false);
  assert.equal(validateQuery({ database: 'db', query: 'q', max_results: 1 }), true);
  assert.equal(validateQuery({ database: 'db', query: 'q', type: 'knowledge' }), false);
});

test('unified response schema declares root arrays and exact chunk identity/content without source metadata', async () => {
  const { spec: resolved } = await SwaggerClient.resolve({ spec: structuredClone(spec) });
  const schema = resolved.paths['/query'].post.responses['200'].content['application/json'].schema;
  const validate = new Ajv({ strict: false }).compile(schema);
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...fixture, data: { ...fixture.data, chunks: [] } }), true);
  assert.equal(validate({ ...fixture, data: { ...fixture.data, graph: {} } }), false);
  const chunk = schema.properties.data.properties.chunks.items;
  for (const key of ['chunk_id', 'context_id', 'score', 'content', 'enrichment', 'received_at', 'temporal', 'chunk_metadata']) assert.ok(chunk.properties[key], key);
  for (const key of ['source_title', 'metadata', 'additional_metadata']) assert.equal(Object.hasOwn(chunk.properties, key), false);
});
