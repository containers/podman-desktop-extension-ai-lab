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

import { beforeEach, test, vi, expect } from 'vitest';
import { EventEmitter, kubernetes, type Uri } from '@podman-desktop/api';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { KubernetesInferenceManager } from './kubernetesInferenceManager';
import { InferenceType, RuntimeType } from '@shared/src/models/IInference';
import type { ModelsManager } from '../modelsManager';

vi.mock('@podman-desktop/api', async () => {
  return {
    EventEmitter: vi.fn(),
    kubernetes: {
      onDidUpdateKubeconfig: vi.fn(),
      getKubeconfig: vi.fn(),
    },
    Disposable: {
      from: vi.fn(),
      create: vi.fn(),
    },
  };
});

const taskRegistryMock = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
  getTasksByLabels: vi.fn(),
} as unknown as TaskRegistry;

const modelsManager = {
  getLocalModelPath: vi.fn(),
  uploadModelToPodmanMachine: vi.fn(),
} as unknown as ModelsManager;

beforeEach(() => {
  vi.mocked(kubernetes.getKubeconfig).mockReturnValue({ fsPath: 'C:\\Users\\axels\\.kube\\config'} as unknown as Uri);

  // mock EventEmitter logic
  const listeners: ((value: unknown) => void)[] = [];

  vi.mocked(EventEmitter).mockReturnValue({
    event: vi.fn().mockImplementation(callback => {
      listeners.push(callback);
    }),
    fire: vi.fn().mockImplementation((content: unknown) => {
      listeners.forEach(listener => listener(content));
    }),
  } as unknown as EventEmitter<unknown>);
});

test('create inference server', async () => {
  const kubeInferenceManager = new KubernetesInferenceManager(taskRegistryMock, modelsManager);
  const server = await kubeInferenceManager.create({
    runtime: RuntimeType.KUBERNETES,
    port: 8888,
    labels: {},
    modelsInfo: [{
      id: 'hf.instructlab.granite-7b-lab-GGUF',
      sha256: '893ae2442b36b2e8e1134ccbf8c0d9bd670648d0964509202ab30c9cbb3d2114',
      backend: InferenceType.LLAMA_CPP,
      name: 'hf.instructlab.granite-7b-lab-GGUF',
      memory: 4080218931,
      hw: '',
      "properties": {
        "chatFormat": "openchat"
      },
      description: '',
      url: 'https://huggingface.co/facebook/detr-resnet-101/resolve/no_timm/pytorch_model.bin'
    }]
  });
  expect(server).toBeDefined();
}, { timeout: 1000 * 3600 });
