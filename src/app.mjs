import { ACCEPTANCE_PROMPT, ACCEPTANCE_SCHEMA, checkAcceptance } from './acceptance.mjs';
import { MODELS, RUNTIME_VERSION, modelRecord } from './models.mjs';
import { createOperation } from './operation.mjs';

const byId = (id) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element: ${id}`);
  return element;
};
const modelInput = byId('model');
for (const model of MODELS) modelInput.add(new Option(model.label, model.id));
const status = byId('status');
let engine;
let worker;
let busy = false;
let evidence;
let operation;
function terminateWorker() {
  worker?.terminate();
  worker = undefined;
  engine = undefined;
}
function watchWorker(target) {
  const failed = (event) => {
    if (worker !== target) return;
    const error = new Error(event.message || 'The model worker failed to communicate. Prepare the model again.');
    if (operation) operation.fail(error);
    else {
      if (evidence) evidence.workerFailure = { at: new Date().toISOString(), error: error.message };
      terminateWorker(); status.textContent = error.message; controls();
    }
  };
  target.addEventListener('error', failed);
  target.addEventListener('messageerror', failed);
}
const chosen = () => MODELS.find((model) => model.id === modelInput.value) ?? MODELS[0];
function controls() {
  byId('prepare').disabled = busy || Boolean(engine);
  byId('unload').disabled = busy || !engine;
  byId('send').disabled = busy || !engine;
  byId('check').disabled = busy || !engine;
  modelInput.disabled = busy || Boolean(engine);
  byId('export').disabled = !evidence;
  byId('cancel').disabled = !busy || !operation;
}
function describe() {
  const model = chosen();
  byId('requirements').textContent = `${model.download} download · ${model.memory} · shader-f16 · 4,096-token context`;
  byId('prepare').textContent = `Prepare ${model.label.split(' · ')[0]} (${model.download})`;
}
modelInput.addEventListener('change', () => { byId('answer').textContent = ''; describe(); });
byId('cancel').addEventListener('click', () => { operation?.cancel(); status.textContent = 'Cancelling…'; });
byId('prepare').addEventListener('click', async () => {
  if (busy || engine) return;
  busy = true;
  const current = createOperation({ terminate: terminateWorker, graceMs: 0 });
  operation = current;
  controls();
  const model = chosen();
  const started = performance.now();
  byId('answer').textContent = '';
  evidence = { evidenceVersion: 1, toolkitRevision: import.meta.env.VITE_TOOLKIT_REVISION || 'unrecorded', modelId: model.id, repo: model.repo, revision: model.revision, artifact: modelRecord(model), runtime: RUNTIME_VERSION, browser: navigator.userAgent, at: new Date().toISOString(), contextTokens: 4096, runs: [] };
  try {
    await current.run(async () => {
    const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (!current.active) return;
    if (!adapter) throw new Error('This browser did not provide a WebGPU adapter. Try a current supported browser with hardware acceleration enabled.');
    if (!adapter.features.has('shader-f16')) throw new Error('This conversion requires shader-f16, which the browser adapter does not offer.');
    evidence.preflightAdapter = { note: 'Independent preflight probe; not a verified identity of the worker engine adapter.', vendor: adapter.info?.vendor, architecture: adapter.info?.architecture, description: adapter.info?.description };
    const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
    if (!current.active) return;
    worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
    watchWorker(worker);
    const loaded = await CreateWebWorkerMLCEngine(worker, model.id, {
      appConfig: { model_list: [modelRecord(model)] },
      initProgressCallback: (progress) => { if (current.active) status.textContent = progress.text; },
    });
    if (current.active) engine = loaded;
    });
    evidence.prepareMs = performance.now() - started;
    status.textContent = `${model.label} is ready. Preparation took ${(evidence.prepareMs / 1000).toFixed(1)} seconds, including any download and shader work.`;
  } catch (error) {
    terminateWorker();
    evidence.prepareError = error instanceof Error ? error.message : String(error);
    status.textContent = evidence.prepareError;
  } finally {
    evidence.prepareMs = performance.now() - started;
    evidence.prepareInterrupted = current.interrupted;
    operation = undefined;
    busy = false;
    controls();
  }
});
byId('unload').addEventListener('click', async () => {
  if (busy || !engine) return;
  busy = true;
  const current = createOperation({ terminate: terminateWorker, timeoutMs: 5000, graceMs: 0 });
  operation = current;
  controls();
  try { await current.run(() => engine.unload()); }
  catch (error) { if (evidence) evidence.releaseError = error instanceof Error ? error.message : String(error); }
  finally { terminateWorker(); operation = undefined; busy = false; status.textContent = 'Model worker released. Browser-cached files are retained.'; controls(); }
});
async function generate(structured) {
  if (busy || !engine || !evidence) return;
  const prompt = structured ? ACCEPTANCE_PROMPT : byId('prompt').value.trim();
  if (!prompt) return;
  busy = true;
  const currentEngine = engine;
  const current = createOperation({ interrupt: () => currentEngine.interruptGenerate(), terminate: terminateWorker, timeoutMs: 90_000 });
  operation = current;
  controls();
  const result = { kind: structured ? 'structured-acceptance' : 'chat', prompt, seed: 7, temperature: 0, maxTokens: 256, startedAt: new Date().toISOString() };
  if (structured) result.schema = ACCEPTANCE_SCHEMA;
  const started = performance.now();
  let text = '';
  byId('answer').textContent = '';
  status.textContent = 'Generating in this browser…';
  try {
    await current.run(async () => {
    const stream = await currentEngine.chat.completions.create({
      stream: true,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0, seed: 7, max_tokens: 256,
      ...(structured ? { response_format: { type: 'json_object', schema: JSON.stringify(ACCEPTANCE_SCHEMA) } } : {}),
    });
    for await (const chunk of stream) {
      if (!current.active) break;
      text += chunk.choices[0]?.delta.content ?? '';
      if (chunk.choices[0]?.finish_reason) result.finishReason = chunk.choices[0].finish_reason;
      byId('answer').textContent = text;
    }
    });
    if (structured) result.acceptance = checkAcceptance(text);
    status.textContent = structured ? (result.acceptance.pass ? 'The small structured-output check passed.' : 'The structured-output check failed. See the returned text and exported evidence.') : text ? 'Reply complete. Check factual claims independently.' : 'The model returned no text.';
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    status.textContent = result.error;
  } finally {
    result.output = text;
    result.interrupted = current.interrupted;
    if (current.interrupted) terminateWorker();
    result.totalMs = performance.now() - started;
    evidence.runs.push(result);
    operation = undefined;
    busy = false;
    controls();
  }
}
byId('send').addEventListener('click', () => { void generate(false); });
byId('check').addEventListener('click', () => { void generate(true); });
byId('export').addEventListener('click', () => {
  if (!evidence) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'eurollm-run-evidence.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
describe();
controls();
