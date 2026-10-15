# Running EuroLLM in the browser: WebGPU conversion and lessons learned

Publication draft, 15 October 2026. This document has not been posted to a
publication platform. Verify the linked deployment before posting. This is a practical engineering
report, not a claim of model novelty or an official UTTER announcement.

EuroLLM is a European multilingual model family from the UTTER project. I
converted the 1.7B Instruct and open 9B Instruct 2512 releases for MLC/WebGPU
so people can experiment with them directly in a compatible browser. The
quantized weights and compiled libraries are already public on Hugging Face:

- [1.7B conversion](https://huggingface.co/dstefl/EuroLLM-1.7B-Instruct-q4f16_1-MLC)
- [9B Instruct 2512 conversion](https://huggingface.co/dstefl/EuroLLM-9B-Instruct-2512-q4f16_1-MLC)

The useful contribution is the packaging and integration work: weight
conversion, a matching compiled WebGPU library, explicit runtime versions,
and a small demo that asks before downloading and saves local run evidence.
It does not train or improve the underlying language model. Credit for the
models belongs to UTTER and for the runtime/compiler to MLC AI and TVM.

## What trying it requires

No account or inference server is needed for the demo. A compatible WebGPU
browser, shader-f16 support and sufficient GPU memory are required. First
preparation downloads approximately 0.9 GB for 1.7B or 4.9 GB for 9B. Browser
cache may save subsequent transfers. Download time and shader preparation
must be reported separately from answer latency when comparing runs.

Prompts are processed in the browser. The downloadable evidence file contains
prompts, answers, browser/preflight hardware information, timing and errors;
review it before sharing. Local execution does not make model answers true.
The small structured-output control checks only one JSON contract.

## What the engineering work taught me

A model name and a quantization suffix are insufficient deployment identity.
The runtime, model/config revision and compiled library must agree. An exact
artifact URL is more useful than a mutable main-branch link when diagnosing
a failed reproduction. A successful constrained output can coexist with
weak plain instruction following, so both need to be recorded.

Downloads and GPU work also need recoverable interfaces. The demo offers
explicit preparation, cancellation, release and visible unsupported-device
states. Failure evidence includes partial output instead of retaining an old
answer that could be mistaken for the current result.

The included Linux source recipe pins a compiler commit and resolves model
references to immutable SHAs, recording dependency/tool snapshots and output
checksums. It is experimental, not a freshly verified clean rebuild or a
promise of bit-identical bytes. New compiler/runtime combinations and new
compiled libraries require fresh actual-GPU acceptance.

## What is known about usage

At 13:01 Europe/Prague on 15 October 2026, the public Hub metadata reported
2 counted downloads in the last month and 32 all-time for 9B, and 67/109 for
1.7B. These are Hub-counted download-file requests, not unique people or active
inference sessions. My own verification can contribute. Cached browser reuse
can go uncounted. These figures therefore do not establish organic adoption.
[Hugging Face explains its counting rules](https://huggingface.co/docs/hub/models-download-stats).

## Reproduce and contribute

[Try the browser demo](https://dstefl.github.io/eurollm-webgpu/),
[read or reuse the source](https://github.com/dstefl/eurollm-webgpu), and
[review the recorded compatibility checks](compatibility-2026-10-15.md).
The checks include the1.7B instruction failure as well as successful
JSON and lifecycle controls, with exact runtime and single-machine scope. Toolkit code uses Apache 2.0; source
models and dependencies retain their own licenses and attribution.

Useful contributions include independently reproduced runs, browser/GPU
compatibility reports and representative multilingual quality evaluation.
Please avoid uploading private prompts or personal hardware details you do
not want to share. No first, only or universal compatibility claim is made.
