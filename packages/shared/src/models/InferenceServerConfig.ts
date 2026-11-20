/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
import type { ModelInfo } from './IModelInfo';
import type { ContainerProviderConnectionInfo } from './IContainerConnectionInfo';

export type CreationInferenceServerOptions = Partial<InferenceServerConfig> & { modelsInfo: ModelInfo[] };

/**
 * Default llama.cpp context size (--ctx-size).
 * llama.cpp now defaults to the model training context (e.g. 128k), which does not fit in GPU memory
 * on podman machines; keep the 4096 default of previous llama.cpp releases.
 */
export const LLAMA_CPP_DEFAULT_CTX_SIZE = 4096;
// 0 is not allowed: llama.cpp interprets it as "use the model training context"
export const LLAMA_CPP_MIN_CTX_SIZE = 512;
export const LLAMA_CPP_MAX_CTX_SIZE = 131072;

export interface InferenceServerConfig {
  /**
   * Port to expose
   */
  port: number;
  /**
   * The connection info to use
   */
  connection?: ContainerProviderConnectionInfo;
  /**
   * The name of the inference provider to use
   */
  inferenceProvider?: string;
  /**
   * Image to use
   */
  image?: string;
  /**
   * Labels to use for the container
   */
  labels: { [id: string]: string };

  /**
   * Model info for the models
   */
  modelsInfo: ModelInfo[];
  /**
   * Number of layers to offload to the GPU when GPU acceleration is enabled
   * @default undefined llama.cpp offloads as many layers as fit in device memory
   * 999 to offload all the layers
   */
  gpuLayers?: number;
  /**
   * Context size (in tokens) of the llama.cpp inference server (--ctx-size).
   * Only used by the llama.cpp provider, it is fixed when the container is created.
   * @default LLAMA_CPP_DEFAULT_CTX_SIZE
   */
  ctxSize?: number;
}
