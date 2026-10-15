import assert from 'node:assert/strict';
import test from 'node:test';
import { checkAcceptance } from '../src/acceptance.mjs';
import { MODELS, modelRecord } from '../src/models.mjs';

test('acceptance rejects wrong values, extra fields, malformed and non-object output', () => {
  assert.equal(checkAcceptance('{"marker":"EUROLLM_READY","minutes":60}').pass, true);
  for (const raw of ['{"marker":"EUROLLM_READY","minutes":59}', '{"marker":"EUROLLM_READY","minutes":60,"apply":true}', '{"marker":"OTHER","minutes":60}', 'null', '[]', 'not JSON']) {
    assert.equal(checkAcceptance(raw).pass, false, raw);
  }
});

test('every artifact uses its immutable public revision and explicit context', () => {
  for (const model of MODELS) {
    assert.match(model.revision, /^[a-f0-9]{40}$/);
    const record = modelRecord(model);
    assert.ok(record.model.endsWith(`/resolve/${model.revision}/`));
    assert.ok(record.model_lib.startsWith(record.model));
    assert.equal(record.overrides.context_window_size, 4096);
    assert.equal(record.model_lib.includes('/resolve/main/'), false);
  }
});
