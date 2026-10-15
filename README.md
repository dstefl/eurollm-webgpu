# EuroLLM in your browser

A small browser demo and reusable tools for the public **EuroLLM 1.7B** and
**EuroLLM 9B Instruct 2512** MLC/WebGPU conversions. The demo needs no account
or inference server. After you choose Prepare, model files download from
Hugging Face and prompts run locally in your browser.

**Status:** public source with local verification. The hosted
demo and detailed compatibility report await publication approval. Known
limitation: the 1.7B conversion can miss simple plain-text instructions even
when its small structured-output control passes. The experimental source-build
recipe has not been freshly rebuilt end to end. Raw diagnostic exports are
kept local and are not included in this source package.

## Try locally

Requires Node 22.18 or newer and npm.

~~~sh
npm ci
npm run dev
~~~

Open the loopback URL printed by Vite. Choose a model, review the download and
memory requirements, then press Prepare. You can cancel preparation or a
response and release the model worker. Cached downloads remain in the browser.
The structured-output check verifies one small schema and its exact values.
It does not establish model accuracy or multilingual instruction following.

| Conversion | First model download | GPU budget at 4,096 tokens |
|---|---:|---|
| EuroLLM 1.7B Instruct | about 0.9 GB | about 1.9 GB estimate |
| EuroLLM 9B Instruct 2512 | about 4.9 GB | about 6.7 GB compiler estimate; plan for 8 GB or more |

Both conversions require WebGPU and shader-f16. Memory figures are estimates,
not a guarantee that a particular card or browser will succeed. Initial
preparation includes network transfer and shader compilation; a cached run
has a different cost. Model answers can be wrong. A seed does not guarantee
identical regeneration across hardware, runtimes or kernels.

Download run evidence to retain artifact URLs and revisions, runtime, browser,
preflight GPU metadata when exposed, prompts, outputs, errors and timings.
**The export contains your prompts and answers.** It stays on your device
until you choose to share it. A preflight adapter probe is not proof of the
worker engine's actual adapter identity.

## Runtime and artifacts

The demo pins **WebLLM 0.2.84** and immutable Hugging Face artifact revisions.
A runtime upgrade needs its own real-browser acceptance. The conversion recipe
pins MLC-LLM commit 2008fe8343e1f40ef89ee57b9287aebcf1b86c98 and its recursive
submodules. That compiler pin alone does not establish bit-identical rebuilds
or complete historical provenance of the previously published artifacts.

- [EuroLLM 1.7B conversion and model card](https://huggingface.co/dstefl/EuroLLM-1.7B-Instruct-q4f16_1-MLC)
- [EuroLLM 9B Instruct 2512 conversion and model card](https://huggingface.co/dstefl/EuroLLM-9B-Instruct-2512-q4f16_1-MLC)

The 9B package uses the open 2512 source revision, rather than the older gated
9B repository. Original authors, model limitations and licenses are identified
in the model cards. This is a conversion and deployment toolkit, not a newly
trained model or an official UTTER release.

## Experimental source conversion

Run scripts/build-eurollm.sh on Linux. Prerequisites include build-essential,
git, curl, GNU time, Node/npm, Rust/Cargo, LLVM 18 development tools, clang 18,
libzstd-dev, zlib1g-dev, libtinfo-dev, libedit-dev, libxml2-dev and libssl-dev.
The recipe installs pinned uv and a managed Python 3.12 environment inside
WORKDIR, records the resolved upstream model SHA, builds TVM/MLC and Emscripten,
and runs weight conversion, configuration and WebGPU compilation.

~~~sh
MODEL_REPO=utter-project/EuroLLM-1.7B-Instruct \
WORKDIR="$PWD/build-1.7b" bash scripts/build-eurollm.sh
~~~

MODEL_REVISION selects a source reference; even a branch name is resolved to
an immutable SHA before downloading. Sources and outputs use revision-specific
directories. Mismatched or modified compiler caches are refused without deletion.
Use a fresh WORKDIR when changing compiler inputs.

Each run saves logs, inputs, tool versions, Python dependency snapshots,
submodule revisions and output checksums under provenance/<timestamp>-<pid>/.
Review local paths and logs before sharing. Dependencies are recorded rather
than fully locked, so the recipe does not promise identical build bytes.
A 9B source conversion needs substantially more memory, disk and time than
its quantized browser inference. No guaranteed build resource figure is claimed.
Validate any new compiled library with actual shader compilation, plain chat,
structured output and recovery on real GPU hardware before publishing it.
The recipe uploads nothing.

## Usage counters

~~~sh
node scripts/usage.mjs
~~~

This reads public Hub metadata without downloading model weights. Counters
measure **Hub-counted requests to designated download files**, not unique
people, active inference or organic adoption. Your own verification can count;
cached reuse can go uncounted. Missing counters stay unknown rather than zero.
See [Hugging Face counting rules](https://huggingface.co/docs/hub/models-download-stats).

## Check and build

~~~sh
npm test
npm run build
~~~

Schema, lifecycle and manifest tests do not establish GPU compatibility.
Real-browser acceptance must separately record the exact bundle, runtime,
artifact identity, hardware scope and both successful and failed checks.
A hosted demo and practical article will be linked after verification.

## License

Toolkit code is licensed under **Apache 2.0**; see LICENSE and NOTICE.
Original EuroLLM weights remain with the UTTER project under their stated
license. WebLLM, TVM, MLC and other dependencies retain their licenses and
attribution. This project is not affiliated with or endorsed by those projects.


## Model-card updates

[Prepared model cards](docs/model-cards/) replace the old private build links
with this public toolkit, pin artifact URLs and describe experimental limits.
They are proposed replacements, not live Hub-card updates. This environment
has no authenticated Hugging Face publishing session. No model files or
model configuration are changed by these documents.
