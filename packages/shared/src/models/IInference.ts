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

export enum InferenceType {
  LLAMA_CPP = 'llama-cpp',
  WHISPER_CPP = 'whisper-cpp',
  OPENVINO = 'openvino',
  ALL = 'all',
  NONE = 'none',
}

const InferenceTypeLabel = {
  'llama-cpp': 'llamacpp',
  'whisper-cpp': 'whispercpp',
  openvino: 'openvino',
  all: 'all',
  none: 'None',
};

// toInferenceType casts a string to InferenceType
// returns NONE value if input value is undefined or unknown
export function toInferenceType(type: string | undefined): InferenceType {
  if (!type) {
    return InferenceType.NONE;
  }
  if (Object.values(InferenceType).includes(type as InferenceType)) {
    return type as InferenceType;
  }
  return InferenceType.NONE;
}

export function inferenceTypeLabel(type: InferenceType): string {
  if (type in InferenceTypeLabel) {
    return InferenceTypeLabel[type];
  }
  return InferenceTypeLabel['none'];
}

export type InferenceServerStatus = 'stopped' | 'running' | 'deleting' | 'stopping' | 'error' | 'starting';

export interface InferenceServer {
  /**
   * Supported models
   */
  models: ModelInfo[];
  /**
   * Container info
   */
  container: {
    engineId: string;
    containerId: string;
  };
  connection: {
    port: number;
  };
  /**
   * Inference server status
   */
  status: InferenceServerStatus;
  /**
   * Health check
   */
  health?: {
    Status: string;
    FailingStreak: number;
    Log: Array<{
      Start: string;
      End: string;
      ExitCode: number;
      Output: string;
    }>;
  };
  /**
   * Exit code
   */
  exit?: number;
  /**
   * The type of inference server (aka backend)
   */
  type: InferenceType;
  /**
   * Inference labels
   */
  labels: Record<string, string>;
}
