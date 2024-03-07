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

import type { LocalModelInfo } from './ILocalModelInfo';

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  hw: string;
  registry: string;
  license: string;
  url: string;
  file?: LocalModelInfo;
  state?: 'deleting';
}

export interface ModelInfoResource {
  /**
   * Original link
   */
  canonicalUrl: string;
  /**
   * Link to the paper
   */
  paperUrl: string | undefined;
  /**
   * Repository link
   */
  downloadUrl: string;
}

export interface ModelInfoAuthor {
  name: string;
  blurb: string;
  url: string;
}

export type ModelArch =
  | 'llama'
  | 'pythia'
  | 'gpt-neo-x'
  | 'gpt-j'
  | 'mpt'
  | 'replit'
  | 'starcoder'
  | 'falcon'
  | 'mistral'
  | 'stablelm'
  | 'phi2'
  | 'qwen2'
  | 'gemma';

export interface ModelInfoFile {
  // identifier
  name: string;
  // download url
  url: string;
  sizeBytes: number;
  quantization:
    | 'q4_0'
    | 'q4_1'
    | 'q5_0'
    | 'q5_1'
    | 'q8_0'
    | 'Q8_0'
    | 'Q2_K'
    | 'Q3_K_S'
    | 'Q3_K_M'
    | 'Q4_K_S'
    | 'Q4_K_M'
    | 'Q5_K_S'
    | 'Q5_K_M'
    | 'Q6_K'
    | unknown;
  format: 'gguf' | unknown;
  sha256checksum: string;
  publisher: {
    name: string;
    socialUrl: string;
  };
  respository: string;
  repositoryUrl: string;
}

export interface ModelInfoRef {
  name: string;
}

export interface ExtendedModelInfo {
  _descriptorVersion: '0.0.1' | unknown;
  datePublished: string;
  name: string;
  description: string;
  resources: ModelInfoResource;
  author: ModelInfoAuthor;
  numParameters: '1.5B' | '2B' | '3B' | '4B' | '6.7B' | '7B' | '13B' | '15B' | '30B' | '65B' | unknown;
  trainedFor: 'chat' | 'instruct' | 'code_completion' | 'other';
  arch: ModelArch;
  files: {
    highlighted: {
      economical: ModelInfoRef;
      most_capable?: ModelInfoRef;
    };
    all: ModelInfoFile[];
  };
}
