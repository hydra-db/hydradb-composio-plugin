const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const SwaggerClient = require('swagger-client');
const YAML = require('yaml');

const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));
const items = JSON.stringify([{ id: 'note-1', title: 'note', content: { text: 'Remember this note.' }, infer: true }]);
globalThis.fetch = async () => { throw new Error('Unexpected network request in offline contract test'); };

async function execute(operationId, requestBody, parameters = { 'API-Version': '2' }) {
  let request;
  const client = await new SwaggerClient({
    spec: structuredClone(spec),
    authorizations: { bearerAuth: { value: 'offline-test-token' } },
    userFetch: async (url, init) => {
      request = new Request(url, init);
      return new Response(JSON.stringify({ success: true, data: { chunks: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.deepEqual(client.errors, []);
  await client.apis.default[operationId](parameters, { requestBody });
  return request;
}

function ingestBody() {
  const properties = spec.paths['/context/ingest'].post.requestBody.content['multipart/form-data'].schema.properties;
  return {
    tenant_id: 'offline-db',
    app_knowledge: items,
    ...Object.fromEntries(Object.entries(properties).filter(([, property]) => 'default' in property).map(([name, property]) => [name, property.default])),
  };
}

test('the declared ingest selector produces canonical multipart type and preserves knowledge data', async () => {
  const request = await execute('ingest_knowledge', ingestBody());
  assert.equal(new URL(request.url).pathname, '/context/ingest');
  assert.match(request.headers.get('content-type'), /^multipart\/form-data; boundary=/);
  const form = await request.formData();
  assert.equal(form.get('type'), 'knowledge');
  assert.equal(form.has('kind'), false);
  assert.equal(form.get('tenant_id'), 'offline-db');
  assert.equal(form.get('app_knowledge'), items);
});

for (const [endpoint, operationId, body] of [
  ['/query', 'recall_context', { database: 'offline-db', query: 'note', type: 'knowledge' }],
  ['/context/ingest', 'ingest_knowledge', ingestBody()],
]) {
  test(`${operationId} serializes an explicitly supplied API-Version 2 header with bearer auth`, async () => {
    const request = await execute(operationId, body);
    assert.equal(request.headers.get('API-Version'), '2');
    assert.equal(request.headers.get('Authorization'), 'Bearer offline-test-token');
    const { spec: resolved, errors } = await SwaggerClient.resolve({ spec: structuredClone(spec) });
    assert.deepEqual(errors, []);
    const parameter = resolved.paths[endpoint].post.parameters.find((entry) => entry.in === 'header' && entry.name === 'API-Version');
    assert.equal(parameter.required, true);
    assert.deepEqual(parameter.schema, { type: 'string', enum: ['2'] });
  });

  test(`${operationId} requires an explicit version instead of assuming a schema default injects it`, async () => {
    await assert.rejects(() => execute(operationId, body, {}), /Required parameter API-Version is not provided/);
  });
}

for (const type of ['knowledge', 'memory']) {
  test(`query preserves the explicit ${type} override`, async () => {
    const request = await execute('recall_context', { database: 'offline-db', query: 'note', type });
    assert.equal(new URL(request.url).pathname, '/query');
    const body = await request.json();
    assert.equal(body.type, type);
    assert.equal(Object.hasOwn(body, 'kind'), false);
  });
}

test('the query selector retains its existing choices and knowledge default', () => {
  const properties = spec.paths['/query'].post.requestBody.content['application/json'].schema.properties;
  assert.deepEqual(properties.type, { type: 'string', enum: ['knowledge', 'memory'], default: 'knowledge' });
  assert.equal(Object.hasOwn(properties, 'kind'), false);
});
