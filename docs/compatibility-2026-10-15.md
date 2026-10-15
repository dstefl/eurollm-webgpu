# Recorded browser compatibility — 15 October 2026

Actual GPU checks used source **14903153098b3f7293057a6e877ce54a9e755184**,
WebLLM **0.2.84**, Chromium **151**, an NVIDIA **RTX 3090**, and the immutable
artifacts in [src/models.mjs](../src/models.mjs). The exported adapter probe
is independent preflight information; it does not identify the worker
engine's selected adapter. Later publication changes add documentation and
hosting without changing generation or worker code.

| Check | EuroLLM 1.7B | EuroLLM 9B Instruct 2512 |
|---|---|---|
| Prepare, including transfer and shaders | 73.421 s | 385.588 s |
| Nonempty plain chat | passed | passed |
| Exact plain marker instruction | **failed: explanatory text** | passed |
| Small constrained JSON control | passed | passed |
| Cancel with bounded recovery | passed | passed |
| Reprepare, second JSON, release and reload | passed | passed |

Both lifecycle cases passed in 8.6 minutes total. These are single-machine
observations. Preparation times include network, cache and shader conditions;
they are not inference-speed rankings. One small JSON control does not
establish language quality, repeated reliability or universal compatibility.
The 1.7B limitation is visible before preparation. No tested setting is
advertised as a quality repair.

Eight Node tests cover schema/artifact identity, operation ownership,
abort/recovery and public usage metadata. Six separate browser cases cover
320/390/1280px layout, no download before preparation, unavailable GPU/shader
states, worker failure, cancellation and evidence export. Their injected
faults are separate from the real-GPU lifecycle checks.

The source-build recipe passed Bash syntax and its early Windows refusal.
A fresh complete Linux rebuild, cache-rejection paths, physical-phone GPU
runs and broad multilingual quality evaluation remain unverified.

Raw prompts, replies and detailed diagnostic exports remain private. The
demo downloads evidence only when requested; review its contents before
sharing. This report publishes no raw run exports.
