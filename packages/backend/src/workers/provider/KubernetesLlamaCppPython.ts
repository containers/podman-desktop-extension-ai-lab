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
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { V1Pod } from '@kubernetes/client-node';
import { InferenceType } from '@shared/src/models/IInference';
import { getRandomString } from '../../utils/randomUtils';
import { posix } from 'node:path';
import { AI_LAB_ANNOTATIONS, DEFAULT_NAMESPACE } from '../../managers/inference/kubernetesInferenceManager';
import { getCoreV1Api, getLabels, KubernetesInferenceProvider } from './KubernetesInferenceProvider';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import file from '../../assets/kube-inference-init.sh?raw';
import { getModelPropertiesEnvironmentVariables } from '../../utils/modelsUtils';
import { LLAMA_CPP_INFERENCE_IMAGE } from './PodmanLlamaCppPython';

export class KubernetesLlamaCppPython extends KubernetesInferenceProvider {
  constructor(taskRegistry: TaskRegistry) {
    super(taskRegistry, InferenceType.LLAMA_CPP, 'LLama-cpp (CPU)');
  }

  override enabled(): boolean {
    return true;
  }

  override async perform(config: InferenceServerConfig): Promise<V1Pod> {
    if (config.modelsInfo.length !== 1)
      throw new Error(
        `kubernetes inference creation does not support anything else than one model. (Got ${config.modelsInfo.length})`,
      );

    const modelInfo = config.modelsInfo[0];
    if (!modelInfo.url) throw new Error('only remote models can be used.');

    // todo compute it live for imported models
    if (!modelInfo.sha256) throw new Error('models provided need a valid sha256 value.');

    // get the volume
    const volume = await this.getVolume(modelInfo, config.labels ?? {});
    if (!volume.metadata?.name) throw new Error('invalid volume metadata.');

    const environments = getModelPropertiesEnvironmentVariables(modelInfo);

    const body: V1Pod = {
      metadata: {
        name: `podman-ai-lab-inference-${getRandomString()}`,
        labels: getLabels(),
        annotations: {
          [AI_LAB_ANNOTATIONS.MODEL]: modelInfo.id,
          [AI_LAB_ANNOTATIONS.PORT]: `${config.port}`,
        },
      },
      spec: {
        volumes: [
          {
            name: 'pvc-ai-lab-model',
            persistentVolumeClaim: {
              claimName: volume.metadata.name,
            },
          },
        ],
        containers: [
          {
            livenessProbe: {
              httpGet: {
                port: 8000,
                path: '/docs',
              },
            },
            name: 'llamacpp-cpu',
            image: LLAMA_CPP_INFERENCE_IMAGE,
            ports: [
              {
                containerPort: 8000,
              },
            ],
            volumeMounts: [
              {
                mountPath: '/models',
                name: 'pvc-ai-lab-model',
              },
            ],
            env: [
              {
                name: 'MODEL_PATH',
                value: posix.join('/models', modelInfo.id),
              },
              {
                name: 'HOST',
                value: '0.0.0.0',
              },
              {
                name: 'PORT',
                value: '8000',
              },
              ...Object.entries(environments).map(([key, value]) => ({
                name: key,
                value: value,
              })),
            ],
          },
        ],
        initContainers: [
          {
            name: 'init-inference-model',
            image: 'busybox',
            volumeMounts: [
              {
                mountPath: '/models',
                name: 'pvc-ai-lab-model',
              },
            ],
            env: [
              {
                name: 'MODEL_URL',
                value: modelInfo.url,
              },
              {
                name: 'MODEL_PATH',
                value: posix.join('/models', modelInfo.id),
              },
              {
                name: 'MODEL_SHA256',
                value: modelInfo.sha256,
              },
              {
                name: 'INIT_TIMEOUT',
                value: '3600', // default to one hour
              },
            ],
            command: ['sh', '-c', file.replace(/\r\n/g, '\n')],
          },
        ],
      },
    };

    let result: { body: V1Pod };
    const podTask = this.taskRegistry.createTask(`Creating pod ${body.metadata?.name}`, 'loading', config.labels);
    try {
      result = await getCoreV1Api().createNamespacedPod(DEFAULT_NAMESPACE, body);
      podTask.state = 'success';
    } catch (err: unknown) {
      podTask.state = 'error';
      podTask.error = `Something went wrong while trying to create namespaced pod: ${String(err)}`;
      throw err;
    } finally {
      this.taskRegistry.updateTask(podTask);
    }
    return result.body;
  }

  override dispose(): void {
    throw new Error('Method not implemented.');
  }
}
