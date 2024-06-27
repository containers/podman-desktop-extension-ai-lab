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
import { InferenceProvider } from './InferenceProvider';
import type { V1PersistentVolumeClaim, V1Pod } from '@kubernetes/client-node';
import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import { AI_LAB_ANNOTATIONS, DEFAULT_NAMESPACE } from '../../managers/inference/kubernetesInferenceManager';
import { kubernetes } from '@podman-desktop/api';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import type { InferenceType} from '@shared/src/models/IInference';
import { RuntimeType } from '@shared/src/models/IInference';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { getRandomString } from '../../utils/randomUtils';

export function getKubeConfig(): KubeConfig {
  const uri = kubernetes.getKubeconfig();
  const config = new KubeConfig();
  config.loadFromFile(uri.fsPath);
  return config;
}

export function getLabels(): Record<string, string> {
  return {
    creator: 'podman-ai-lab',
  };
}

export function getLabelSelector(): string {
  return Object.entries(getLabels())
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

export function getCoreV1Api(): CoreV1Api {
  const config = getKubeConfig();
  return config.makeApiClient(CoreV1Api);
}

export abstract class KubernetesInferenceProvider extends InferenceProvider<V1Pod> {

  protected constructor(protected taskRegistry: TaskRegistry, type: InferenceType, name: string) {
    super(RuntimeType.KUBERNETES, type, name);
  }

  protected async getVolumes(): Promise<V1PersistentVolumeClaim[]> {
    const coreAPI = getCoreV1Api();
    const result = await coreAPI.listNamespacedPersistentVolumeClaim(
      DEFAULT_NAMESPACE,
      undefined,
      undefined,
      undefined,
      undefined,
      getLabelSelector(),
    );
    return result.body.items;
  }

  protected async findModelVolume(modelId: string): Promise<V1PersistentVolumeClaim | undefined> {
    // get the volumes
    const volumes = await this.getVolumes();
    return volumes.find(
      volume =>
        volume.metadata?.annotations &&
        AI_LAB_ANNOTATIONS.MODEL in volume.metadata.annotations &&
        volume.metadata.annotations[AI_LAB_ANNOTATIONS.MODEL] === modelId,
    );
  }

  protected async getVolume(modelInfo: ModelInfo, labels: Record<string, string>): Promise<V1PersistentVolumeClaim> {
    let volume = await this.findModelVolume(modelInfo.id);
    if(volume) return volume;

    const volumeTask = this.taskRegistry.createTask(`Creating Kubernetes PVC`, 'loading', labels);

    try {
      volume = await this.createModelVolume(modelInfo);
      volumeTask.state = 'success';
      return volume;
    } catch (err: unknown) {
      volumeTask.state = 'error';
      volumeTask.error = `Something went wrong while creating Kubernetes PVC: ${String(err)}`;
      throw err;
    } finally {
      this.taskRegistry.updateTask(volumeTask);
    }
  }

  protected async createModelVolume(model: ModelInfo): Promise<V1PersistentVolumeClaim> {
    if (!model.memory) throw new Error('model need to have memory estimate');

    const volumeSize = Math.ceil(model.memory / 2 ** 30);

    const coreAPI = getCoreV1Api();
    const result = await coreAPI.createNamespacedPersistentVolumeClaim(DEFAULT_NAMESPACE, {
      metadata: {
        name: `pvc-podman-ai-lab-${getRandomString()}`,
        labels: getLabels(),
        annotations: {
          [AI_LAB_ANNOTATIONS.MODEL]: model.id,
        },
      },
      apiVersion: 'v1',
      spec: {
        accessModes: ['ReadWriteOnce'],
        volumeMode: 'Filesystem',
        resources: {
          requests: {
            storage: `${volumeSize}Gi`,
          },
        },
      },
    });
    return result.body;
  }

}
