const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ES_HOST = process.env.ES_HOST || 'http://localhost:9200';
const ES_INDEX = process.env.ES_INDEX || 'honkit-test';
const exampleDir = path.resolve(__dirname, '../example');
const indexPath = path.join(exampleDir, '_book/search_index.json');

if (!fs.existsSync(indexPath)) {
  // Build the example so the E2E test can run standalone.
  spawnSync('pnpm', ['exec', 'honkit', 'build'], {
    cwd: exampleDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_PATH: path.join(exampleDir, 'node_modules') },
  });
}

async function esAvailable() {
  try {
    const res = await fetch(`${ES_HOST}/_cluster/health`);
    return res.ok;
  } catch {
    return false;
  }
}

test('Elasticsearch end-to-end', { skip: !process.env.RUN_ES_TESTS && 'set RUN_ES_TESTS=1 to enable' }, async (t) => {
  assert.ok(await esAvailable(), `Elasticsearch not reachable at ${ES_HOST}`);

  await t.test('bulk index search_index.json', async () => {
    const body = fs.readFileSync(indexPath, 'utf8');
    const res = await fetch(`${ES_HOST}/${ES_INDEX}/_bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-ndjson' },
      body,
    });
    assert.ok(res.ok, `bulk failed: ${res.status}`);
    const json = await res.json();
    assert.equal(json.errors, false, `bulk reported errors: ${JSON.stringify(json)}`);
    await fetch(`${ES_HOST}/${ES_INDEX}/_refresh`, { method: 'POST' });
  });

  await t.test('search returns expected hits', async () => {
    const res = await fetch(`${ES_HOST}/${ES_INDEX}/_search?q=Elasticsearch`);
    assert.ok(res.ok);
    const json = await res.json();
    assert.ok(json.hits.total.value >= 1, `expected hits for "Elasticsearch", got ${json.hits.total.value}`);
  });

  await t.test('keyword field boosts matches', async () => {
    const res = await fetch(`${ES_HOST}/${ES_INDEX}/_search?q=alpha`);
    assert.ok(res.ok);
    const json = await res.json();
    assert.ok(json.hits.total.value >= 1, 'expected at least one hit for keyword "alpha"');
    assert.equal(json.hits.hits[0]._source.title, 'Page One');
  });

  await t.test('skipped page is not indexed', async () => {
    const res = await fetch(`${ES_HOST}/${ES_INDEX}/_search?q=Skipped`);
    assert.ok(res.ok);
    const json = await res.json();
    assert.equal(json.hits.total.value, 0, 'skipped page must not be indexed');
  });

  t.after(async () => {
    await fetch(`${ES_HOST}/${ES_INDEX}`, { method: 'DELETE' });
  });
});
