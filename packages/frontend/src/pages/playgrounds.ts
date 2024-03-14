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

export interface PlaygroundInfo {
  id: string;
  name: string;
  modelId: string;
}

export const playgroundsList: PlaygroundInfo[] = [
  {
    id: '1',
    modelId: 'hf.TheBloke.llama-2-7b-chat.Q5_K_S',
    name: 'Llama-2-1',
  },
  {
    id: '2',
    modelId: 'hf.TheBloke.llama-2-7b-chat.Q5_K_S',
    name: 'Llama-2-2',
  },
  {
    id: '3',
    modelId: 'hf.TheBloke.mistral-7b-instruct-v0.1.Q4_K_M',
    name: 'Mistral-7B-Instruct-1',
  },
];
