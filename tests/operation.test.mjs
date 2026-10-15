import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperation } from '../src/operation.mjs';

test('hung generation times out and terminates before releasing ownership', async () => {
  const events = [];
  const op = createOperation({ timeoutMs: 5, graceMs: 5, interrupt: () => events.push('interrupt'), terminate: () => events.push('terminate') });
  await assert.rejects(op.run(() => new Promise(() => {})), /timed out/);
  assert.deepEqual(events, ['interrupt', 'terminate']);
  assert.equal(op.active, false);
});

test('cooperative interruption retains ownership through settlement and rejects partial success', async () => {
  let complete;
  let terminated = false;
  const op = createOperation({ graceMs: 1000, interrupt: () => complete('partial'), terminate: () => { terminated = true; } });
  const pending = op.run(() => new Promise((resolve) => { complete = resolve; }));
  await Promise.resolve();
  op.cancel();
  await assert.rejects(pending, /Cancelled/);
  assert.equal(op.interrupted, true);
  assert.equal(terminated, false);
});

test('worker failure settles an otherwise hung preparation and suppresses late work', async () => {
  let complete;
  let terminated = false;
  const op = createOperation({ terminate: () => { terminated = true; } });
  const pending = op.run(() => new Promise((resolve) => { complete = resolve; }));
  await Promise.resolve();
  op.fail(new Error('Worker failed'));
  await assert.rejects(pending, /Worker failed/);
  assert.equal(terminated, true);
  complete('late');
  assert.equal(op.active, false);
});

test('cancel before initialization prevents work; successful completion clears timers', async () => {
  let started = false;
  const cancelled = createOperation({ terminate: () => {} });
  cancelled.cancel();
  await assert.rejects(cancelled.run(() => { started = true; }), /Cancelled/);
  assert.equal(started, false);
  let terminated = false;
  const op = createOperation({ timeoutMs: 5, terminate: () => { terminated = true; } });
  assert.equal(await op.run(() => 'ok'), 'ok');
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(terminated, false);
});
