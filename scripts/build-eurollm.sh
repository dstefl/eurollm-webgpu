#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# EuroLLM WebGPU source-build recipe. No automatic publication.
# Compatible target: WebLLM0.2.84. A new compiler/runtime pair needs fresh GPU tests.
# MODEL_REPO, MODEL_REVISION, QUANTIZATION, CONV_TEMPLATE and WORKDIR are optional.
# Installs build tools in WORKDIR; requires Linux with LLVM18 and build dependencies.
set -euo pipefail

MLC_LLM_REF="${MLC_LLM_REF:-2008fe8343e1f40ef89ee57b9287aebcf1b86c98}"
if [[ ! "$MLC_LLM_REF" =~ ^[0-9a-f]{40}$ ]]; then echo "MLC_LLM_REF must be a full immutable commit" >&2; exit 2; fi
MODEL_REPO="${MODEL_REPO:-utter-project/EuroLLM-1.7B-Instruct}"
QUANTIZATION="${QUANTIZATION:-q4f16_1}"
CONV_TEMPLATE="${CONV_TEMPLATE:-chatml}"
WORKDIR="${WORKDIR:-$(pwd)/eurollm-src}"
MODEL_NAME="$(basename "$MODEL_REPO")"
OUT_NAME="${MODEL_NAME}-${QUANTIZATION}-MLC"
UV_VERSION="${UV_VERSION:-0.12.7}"
EMSDK_VERSION="${EMSDK_VERSION:-3.1.56}"
REQUESTED_MODEL_REVISION="${MODEL_REVISION:-main}"
fail() { echo "$*" >&2; exit 2; }

stage() { echo "::group::[eurollm-src] $1"; }
stage_end() { echo "::endgroup::"; }

stage "preflight"
[[ "$(uname -s)" == Linux ]] || fail 'This experimental recipe requires Linux.'
for tool in git curl realpath nproc free node npm rustc cargo make c++ sha256sum; do
  command -v "$tool" >/dev/null || fail "Missing prerequisite: $tool"
done
[[ -x /usr/bin/time ]] || fail 'Install GNU time (/usr/bin/time).'
[[ "$MODEL_REPO" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail 'MODEL_REPO must be owner/repository.'
[[ "$QUANTIZATION" =~ ^[A-Za-z0-9_]+$ && "$CONV_TEMPLATE" =~ ^[A-Za-z0-9_-]+$ ]] || fail 'Invalid quantization or template.'
[[ "$UV_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && "$EMSDK_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Tool versions must be explicit release numbers.'
JOBS="${JOBS:-$(nproc)}"
[[ "$JOBS" =~ ^[1-9][0-9]*$ ]] || fail 'JOBS must be a positive integer.'
WORKDIR="$(realpath -m -- "$WORKDIR")"
LLVM_CONFIG="$(command -v llvm-config-18 || command -v llvm-config || true)"
[[ -n "$LLVM_CONFIG" ]] || fail 'LLVM 18 development tools are required.'
[[ "$("$LLVM_CONFIG" --version)" == 18.* ]] || fail 'LLVM major version must be 18.'
# Read-only checks precede installers, venv changes and compiler mutations.
if [ -e "$WORKDIR/mlc-llm" ]; then
  [[ "$(git -C "$WORKDIR/mlc-llm" rev-parse HEAD)" == "$MLC_LLM_REF" ]] || fail 'Cached compiler differs. Choose a fresh WORKDIR; nothing was deleted.'
  [[ -z "$(git -C "$WORKDIR/mlc-llm" status --porcelain --untracked-files=no)" ]] || fail 'Cached compiler or submodules are modified; use a fresh WORKDIR.'
  if git -C "$WORKDIR/mlc-llm" submodule status --recursive | grep -qE '^[+U]'; then fail 'Cached submodule revision differs.'; fi
  git -C "$WORKDIR/mlc-llm" submodule foreach --quiet --recursive 'test -z "$(git status --porcelain --untracked-files=no)"' || fail 'A cached submodule is modified.'
  cache="$WORKDIR/mlc-llm/build/CMakeCache.txt"
  if [ -f "$cache" ]; then
    grep -Fxq "CMAKE_HOME_DIRECTORY:INTERNAL=$WORKDIR/mlc-llm" "$cache" || fail 'CMake cache belongs to another source path.'
    grep -Eq "^USE_LLVM:[^=]+=$LLVM_CONFIG$" "$cache" || fail 'CMake cache uses another LLVM configuration.'
    for backend in CUDA VULKAN METAL OPENCL; do
      grep -Eq "^USE_${backend}:[^=]+=OFF$" "$cache" || fail "CMake cache enables or omits $backend; use a fresh WORKDIR."
    done
  fi
fi
mkdir -p "$WORKDIR"
df -h "$WORKDIR" | tail -1
free -h
nproc
cd "$WORKDIR"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
PROVENANCE="$WORKDIR/provenance/$RUN_ID"
mkdir -p "$PROVENANCE"
exec > >(tee "$PROVENANCE/build.log") 2>&1
printf '%s\n' 'Experimental recipe: dependency versions are recorded, not fully locked. A fresh successful rebuild and real-browser acceptance are required.' > "$PROVENANCE/status.txt"
printf 'mlc_commit=%s\nmodel_repo=%s\nrequested_model_ref=%s\nquantization=%s\nconversation_template=%s\nemsdk=%s\nuv=%s\n' "$MLC_LLM_REF" "$MODEL_REPO" "$REQUESTED_MODEL_REVISION" "$QUANTIZATION" "$CONV_TEMPLATE" "$EMSDK_VERSION" "$UV_VERSION" > "$PROVENANCE/build-inputs.txt"
trap 'code=$?; printf "exit_code=%s\n" "$code" >> "$PROVENANCE/status.txt"' EXIT
stage_end

stage "python (uv, managed 3.12) + build deps"
export UV_INSTALL_DIR="$WORKDIR/uv-bin"
export UV_NO_MODIFY_PATH=1
export UV_PYTHON_INSTALL_DIR="$WORKDIR/uv-python"
export UV_CACHE_DIR="$WORKDIR/uv-cache"
export UV_PYTHON_PREFERENCE=only-managed
curl -LsSf "https://astral.sh/uv/${UV_VERSION}/install.sh" | sh
export PATH="$UV_INSTALL_DIR:$PATH"
uv venv --python 3.12 venv
source venv/bin/activate
uv pip install torch --index-url https://download.pytorch.org/whl/cpu
uv pip install cmake ninja "numpy>=2,<2.3" "huggingface_hub[cli]" psutil setuptools pytest \
  transformers safetensors tqdm "pydantic>=2" requests shortuuid prompt_toolkit tornado \
  typing_extensions cloudpickle ml_dtypes scipy packaging
uv pip freeze > "$PROVENANCE/python-freeze-initial.txt"
cmake --version | head -1
stage_end

stage "sources: mlc-llm @ ${MLC_LLM_REF} (with 3rdparty/tvm)"
if [ ! -d mlc-llm ]; then
    git clone --no-checkout https://github.com/mlc-ai/mlc-llm.git
    cd mlc-llm
    git checkout --quiet "$MLC_LLM_REF"
    cd ..
fi
cd mlc-llm
git rev-parse HEAD
git submodule update --init --recursive --depth 1
git submodule status --recursive > "$PROVENANCE/submodules.txt"
cd ..
stage_end

stage "build mlc_llm + tvm runtime (LLVM for CPU, no CUDA)"
echo "llvm-config: ${LLVM_CONFIG:-<none>}"
mkdir -p mlc-llm/build
cd mlc-llm/build
if [ ! -f CMakeCache.txt ]; then
  cmake .. -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DUSE_CUDA=OFF -DUSE_VULKAN=OFF -DUSE_METAL=OFF -DUSE_OPENCL=OFF \
    -DUSE_LLVM="${LLVM_CONFIG:-ON}"
fi
ninja -j"$JOBS" 2>&1 | tee "$PROVENANCE/ninja.log" | tail -20
ls -la tvm/*.so *.so 2>/dev/null || true
cd ../..
stage_end

stage "install the python packages from the tree (editable, --no-deps)"
cd mlc-llm
TVM_SOURCE_DIR="$WORKDIR/mlc-llm/3rdparty/tvm"
export TVM_SOURCE_DIR
export TVM_HOME="$TVM_SOURCE_DIR"
export TVM_LIBRARY_PATH="$WORKDIR/mlc-llm/build/tvm"
export MLC_LLM_SOURCE_DIR="$WORKDIR/mlc-llm"
WHEEL_DIR="$WORKDIR/mlc-llm/wheels"
mkdir -p "$WHEEL_DIR"
if [ -d 3rdparty/tvm/3rdparty/tvm-ffi ]; then
  if ! ls "$WHEEL_DIR"/apache_tvm_ffi-*.whl >/dev/null 2>&1; then
    uv build --wheel --out-dir "$WHEEL_DIR" 3rdparty/tvm/3rdparty/tvm-ffi 2>&1 | tee "$PROVENANCE/tvm-ffi-wheel.log" | tail -5
  fi
  uv pip install "$WHEEL_DIR"/apache_tvm_ffi-*.whl
fi
if [ -f 3rdparty/tvm/pyproject.toml ] && [ ! -f 3rdparty/tvm/python/setup.py ]; then
  export SETUPTOOLS_SCM_PRETEND_VERSION="${TVM_PRETEND_VERSION:-0.22.0}"
  export CMAKE_BUILD_PARALLEL_LEVEL="$JOBS"
  if ! ls "$WHEEL_DIR"/tvm-*.whl >/dev/null 2>&1; then
    uv build --wheel --out-dir "$WHEEL_DIR" 3rdparty/tvm \
      -C "cmake.define.USE_LLVM=${LLVM_CONFIG:-ON}" \
      -C cmake.define.USE_CUDA=OFF \
      -C cmake.define.USE_VULKAN=OFF \
      -C cmake.define.USE_OPENCL=OFF \
      -C cmake.define.USE_METAL=OFF \
      -C cmake.build-type=Release 2>&1 | tee "$PROVENANCE/tvm-wheel.log" | tail -40
  fi
  ls -la "$WHEEL_DIR"
  uv pip install --no-deps "$WHEEL_DIR"/tvm-*.whl
  unset TVM_LIBRARY_PATH
else
  uv pip install --no-deps -e 3rdparty/tvm/python
fi
uv pip install fastapi uvicorn shortuuid tiktoken openai pandas datasets sentencepiece
uv pip install --no-deps -e python
python -c "import tvm, mlc_llm; print('tvm', tvm.__version__, tvm.__file__); print('mlc_llm', mlc_llm.__file__)"
python -c "import tvm_ffi, sys; print('tvm_ffi', getattr(tvm_ffi, '__version__', '?'), tvm_ffi.__file__)" || true
uv pip list | grep -i -E "tvm|mlc|numpy|torch" || true
cd ..
stage_end

stage "emscripten sdk + the TVM web runtime (needed by compile --device webgpu)"
if [ ! -d emsdk ]; then
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git
fi
./emsdk/emsdk install "$EMSDK_VERSION"
./emsdk/emsdk activate "$EMSDK_VERSION"
export EMCC_CFLAGS="-sDEFAULT_TO_CXX=1"
source ./emsdk/emsdk_env.sh
emcc --version | head -1
cd mlc-llm
./web/prep_emcc_deps.sh
cd ..
ls -la "$TVM_HOME/web/dist/wasm/" mlc-llm/web/dist/wasm/ 2>&1 | head -12
stage_end

stage "download source weights: ${MODEL_REPO}"
MODEL_REVISION="$(python -c 'import sys; from huggingface_hub import HfApi; print(HfApi().model_info(sys.argv[1], revision=sys.argv[2]).sha)' "$MODEL_REPO" "$REQUESTED_MODEL_REVISION")"
[[ "$MODEL_REVISION" =~ ^[0-9a-f]{40}$ ]] || fail 'The Hub did not return an immutable model SHA.'
SOURCE_DIR="$WORKDIR/sources/${MODEL_NAME}-${MODEL_REVISION}"
OUT_NAME="$WORKDIR/outputs/${MODEL_NAME}-${MODEL_REVISION}-${QUANTIZATION}-MLC"
mkdir -p "$WORKDIR/sources" "$WORKDIR/outputs"
printf 'mlc_commit=%s\nmodel_repo=%s\nrequested_model_ref=%s\nmodel_sha=%s\nquantization=%s\nconversation_template=%s\nemsdk=%s\nuv=%s\ncontext=source model default (see generated mlc-chat-config.json)\n' "$MLC_LLM_REF" "$MODEL_REPO" "$REQUESTED_MODEL_REVISION" "$MODEL_REVISION" "$QUANTIZATION" "$CONV_TEMPLATE" "$EMSDK_VERSION" "$UV_VERSION" > "$PROVENANCE/build-inputs.txt"
uv pip freeze > "$PROVENANCE/python-freeze.txt"
{ python --version; uv --version; node --version; npm --version; rustc --version; cargo --version; cmake --version; "$LLVM_CONFIG" --version; emcc --version; git -C emsdk rev-parse HEAD; } > "$PROVENANCE/tool-versions.txt"
hf download "$MODEL_REPO" --revision "$MODEL_REVISION" --local-dir "$SOURCE_DIR" --exclude "*.gguf" --exclude "original/*"
stage_end

stage "convert_weight → ${OUT_NAME}"
mkdir -p "$OUT_NAME"
/usr/bin/time -v python -X faulthandler -m mlc_llm convert_weight "$SOURCE_DIR" \
  --quantization "$QUANTIZATION" -o "$OUT_NAME"
stage_end

stage "gen_config (conv template: ${CONV_TEMPLATE})"
python -m mlc_llm gen_config "$SOURCE_DIR" \
  --quantization "$QUANTIZATION" --conv-template "$CONV_TEMPLATE" -o "$OUT_NAME"
stage_end

stage "compile → webgpu model_lib wasm"
python -m mlc_llm compile "$OUT_NAME/mlc-chat-config.json" --device webgpu -o "${OUT_NAME}-webgpu.wasm"
ls -la "${OUT_NAME}-webgpu.wasm"
cp "$OUT_NAME/mlc-chat-config.json" "$PROVENANCE/mlc-chat-config.json"
cp mlc-llm/build/CMakeCache.txt "$PROVENANCE/CMakeCache.txt"
find "$OUT_NAME" -type f -print0 | sort -z | xargs -0 sha256sum > "$PROVENANCE/output-sha256.txt"
sha256sum "${OUT_NAME}-webgpu.wasm" >> "$PROVENANCE/output-sha256.txt"
stage_end

stage "result summary"
du -sh "$OUT_NAME" "${OUT_NAME}-webgpu.wasm"
echo "weights dir: $OUT_NAME"
echo "model_lib:   ${OUT_NAME}-webgpu.wasm"
echo "provenance:  $PROVENANCE (review local paths before sharing)"
stage_end
