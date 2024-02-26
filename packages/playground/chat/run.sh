#!/bin/bash
python -m llama_cpp.server --model ${MODEL_PATH} --host ${HOST:=0.0.0.0} --port ${PORT:=8001} --n_gpu_layers 0
