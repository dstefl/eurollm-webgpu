/** Own an asynchronous worker operation until it settles or its worker is terminated. */
export function createOperation({ interrupt = () => {}, terminate, timeoutMs, graceMs = 2000 }) {
  let settled = false;
  let reason;
  let deadline;
  let grace;
  let rejectFailure;
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  // Cancellation can precede run(), e.g. during a browser permission prompt.
  void failure.catch(() => {});
  const clear = () => { clearTimeout(deadline); clearTimeout(grace); };
  const force = () => {
    if (settled) return;
    settled = true;
    clear();
    try { terminate(); } catch { /* Keep the original failure and settle the caller. */ }
    rejectFailure(reason);
  };
  function cancel(message = 'Cancelled. You can prepare the model again if needed.') {
    if (settled || reason) return;
    reason = new Error(message);
    try { Promise.resolve(interrupt()).catch(() => {}); } catch { /* force remains bounded */ }
    grace = setTimeout(force, graceMs);
  }
  return {
    get active() { return !settled && !reason; },
    get interrupted() { return Boolean(reason); },
    cancel,
    fail(error) {
      if (settled) return;
      reason = error instanceof Error ? error : new Error(String(error));
      force();
    },
    async run(start) {
      if (timeoutMs !== undefined) deadline = setTimeout(() => cancel('Generation timed out; interruption requested.'), timeoutMs);
      try {
        return await Promise.race([
          Promise.resolve().then(() => {
            if (reason) throw reason;
            return start();
          }).then((value) => { if (reason) throw reason; return value; }),
          failure,
        ]);
      } finally {
        settled = true;
        clear();
      }
    },
  };
}
