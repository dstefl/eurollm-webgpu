// Public artifact revisions inspected on 2026-10-15. No mutable resolve/main URLs.
export const RUNTIME_VERSION = '0.2.84';
export const MODELS = Object.freeze([
  {
    id: 'EuroLLM-1.7B-Instruct-q4f16_1-MLC',
    label: 'EuroLLM 1.7B',
    repo: 'dstefl/EuroLLM-1.7B-Instruct-q4f16_1-MLC',
    revision: 'db971a4acc99fa38b3d29c899e9de3ad642dd1c4',
    download: 'about 0.9 GB',
    memory: 'about 1.9 GB estimated GPU budget',
    vramMB: 1900,
  },
  {
    id: 'EuroLLM-9B-Instruct-2512-q4f16_1-MLC',
    label: 'EuroLLM 9B · open 2512 revision',
    repo: 'dstefl/EuroLLM-9B-Instruct-2512-q4f16_1-MLC',
    revision: '90bcd6e01c277f2323a08d8c4daec48e5c09bbd4',
    download: 'about 4.9 GB',
    memory: 'about 6.7 GB compiler-estimated GPU budget at 4K context',
    vramMB: 6700,
  },
]);

export function modelRecord(model) {
  const root = `https://huggingface.co/${model.repo}/resolve/${model.revision}/`;
  return {
    model_id: model.id,
    model: root,
    model_lib: `${root}${model.id}-webgpu.wasm`,
    vram_required_MB: model.vramMB,
    low_resource_required: model.vramMB < 2000,
    required_features: ['shader-f16'],
    overrides: { context_window_size: 4096 },
  };
}
