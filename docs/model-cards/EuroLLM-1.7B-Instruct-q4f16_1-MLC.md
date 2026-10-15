---
license: apache-2.0
base_model: utter-project/EuroLLM-1.7B-Instruct
language:
  - cs
  - en
  - de
  - bg
  - hr
  - da
  - nl
  - et
  - fi
  - fr
  - el
  - hu
  - ga
  - it
  - lv
  - lt
  - mt
  - pl
  - pt
  - ro
  - sk
  - sl
  - es
  - sv
tags:
  - mlc-llm
  - web-llm
  - webgpu
  - quantized
  - q4f16_1
library_name: mlc-llm
---

# EuroLLM-1.7B-Instruct-q4f16_1-MLC — experimental MLC/WebGPU conversion

A q4f16_1 conversion of [utter-project/EuroLLM-1.7B-Instruct](https://huggingface.co/utter-project/EuroLLM-1.7B-Instruct) for browser-local inference with [WebLLM](https://github.com/mlc-ai/web-llm). This is a quantized conversion, not a fine-tune. No claim of being the first or only public conversion is made.

**Runnable source, setup and build recipe:** [dstefl/eurollm-webgpu](https://github.com/dstefl/eurollm-webgpu). Apache-2.0, no account required to read or clone. The demo source downloads model assets only after the user explicitly chooses Prepare. A hosted public demo is not yet enabled.

## Use locally

```sh
git clone https://github.com/dstefl/eurollm-webgpu.git
cd eurollm-webgpu
npm ci
npm run dev
```

Requires Node 22.18 or newer and npm. Open the printed local URL in a browser that supports WebGPU and shader-f16. Choose this model and Prepare, then try a short prompt. The initial model download is large. Browser-local execution still requires fetching the runtime and model assets; it does not imply offline first load. Prompts are processed by the local browser runtime in this demo.

## Direct WebLLM integration

The published WASM artifact targets **@mlc-ai/web-llm 0.2.84**. Pin the runtime and artifact revision together; compatibility with an arbitrary newer runtime is not promised.

```ts
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const id = "EuroLLM-1.7B-Instruct-q4f16_1-MLC";
const revision = "db971a4acc99fa38b3d29c899e9de3ad642dd1c4";
const root = `https://huggingface.co/dstefl/${id}/resolve/${revision}/`;
const engine = await CreateMLCEngine(id, {
  appConfig: {
    model_list: [{
      model: root,
      model_id: id,
      model_lib: `${root}${id}-webgpu.wasm`,
      required_features: ["shader-f16"],
      overrides: { context_window_size: 4096 },
    }],
  },
});
```

The repository contains quantized shards, tokenizer/configuration files and the WebGPU model library. shader-f16 is required. Actual memory use depends on context and the browser/device; this card does not certify a minimum GPU capacity.

## Quality and limits

This conversion remains experimental. Evaluate the quantized artifact on your own tasks before relying on it. The base model's training languages or published scores do not establish this browser build's quality, and schema-constrained JSON is not proof that a model followed the instruction or chose a correct action.

The small conversion has shown instruction-following limitations in local checks. Configuration and tokenization are under investigation; those observations do not isolate model size, quantization or a specific configuration field as the cause. No speculative BOS or chat-template fix is recommended here.

## Build source and reproducibility

The public [build recipe](https://github.com/dstefl/eurollm-webgpu/blob/main/scripts/build-eurollm.sh) records the pinned MLC source, LLVM/toolchain prerequisites, artifact identity and provenance output. It replaces the inaccessible private-repository build link. The recipe is experimental: it has not been freshly rebuilt on a clean Linux machine in the current publication pass. Read the repository's build limitations before starting a long conversion.

## License and attribution

Base model and this conversion: **Apache-2.0**. Credit the UTTER project and retain applicable license/notice files. This conversion is independently maintained by dstefl and is not an official UTTER release. Prepared for [Wattburg](https://wattburg.com), a household-energy simulator with an experimental browser-local model lab.
