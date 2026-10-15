import assert from 'node:assert/strict';
import test from 'node:test';
import { readUsage } from '../scripts/usage.mjs';

test('public counters distinguish missing values from zero and validate model identity', async () => {
  const rows = await readUsage('owner/model', async (url) => {
    assert.equal(url.origin, 'https://huggingface.co');
    assert.equal(url.searchParams.getAll('expand[]').length, 3);
    return new Response(JSON.stringify({ id: 'owner/model', downloads: 0, likes: 0 }));
  });
  assert.equal(rows.countedDownloadsLastMonth, 0);
  assert.equal(rows.countedDownloadsAllTime, null);
  await assert.rejects(readUsage('owner/model', async () => new Response('{"id":"other/model","downloads":2}')), /identity/);
});

test('unexpected metadata, unsuccessful requests and unsafe repository inputs fail visibly', async () => {
  await assert.rejects(readUsage('owner/model', async () => new Response('{"id":"owner/model","downloads":-1}')));
  await assert.rejects(readUsage('owner/model', async () => new Response('unavailable', { status: 503 })), /HTTP 503/);
  await assert.rejects(readUsage('https://other.invalid/model', async () => { throw new Error('must not fetch'); }));
});
