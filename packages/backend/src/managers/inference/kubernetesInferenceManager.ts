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
import { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import { InferenceServerInstance, RuntimeEngine } from './RuntimeEngine';
import { TaskRegistry } from '../../registries/TaskRegistry';
import { InferenceServerStatus, InferenceType, RuntimeType } from '@shared/src/models/IInference';
import { type Disposable, kubernetes } from '@podman-desktop/api';
import {
  CoreV1Api,
  KubeConfig,
  type V1PersistentVolumeClaim,
  type V1Pod,
  makeInformer,
  Informer,
} from '@kubernetes/client-node';
import { ModelInfo } from '@shared/src/models/IModelInfo';
import { posix } from 'node:path';
import { getRandomString } from '../../utils/randomUtils';
import file from '../../assets/kube-inference-init.sh?raw';
import { ADD, CHANGE, DELETE, ERROR, UPDATE } from '@kubernetes/client-node';
import { ModelsManager } from '../modelsManager';

export const DEFAULT_NAMESPACE = 'default';

export enum AI_LAB_ANNOTATIONS {
  MODEL = 'podman-ai-lab-model',
}

export class KubernetesInferenceManager extends RuntimeEngine {
  #servers: Map<string, InferenceServerInstance>;
  #kubeConfigDisposable: Disposable | undefined;
  #informer: Informer<V1Pod> | undefined;
  #watchers: Disposable[];

  constructor(taskRegistry: TaskRegistry, private modelManager: ModelsManager) {
    super('kubernetes', RuntimeType.KUBERNETES, taskRegistry);

    this.#servers = new Map();
    this.#watchers = [];
  }

  override init(): void {
    this.#kubeConfigDisposable = kubernetes.onDidUpdateKubeconfig(() => {
      this.refresh();
    });

    this.initInformer();
  }

  protected initInformer(): void {
    const coreApi = this.getCoreV1Api();

    const listFn = () => coreApi.listNamespacedPod(DEFAULT_NAMESPACE);
    this.#informer = makeInformer(this.getKubeConfig(), `/api/v1/namespaces/${DEFAULT_NAMESPACE}/pods`, listFn, this.getLabelSelector());
    this.#informer.on(ADD, this.updateStatus.bind(this, ADD));
    this.#informer.on(UPDATE, this.updateStatus.bind(this, UPDATE));
    this.#informer.on(CHANGE, this.updateStatus.bind(this, CHANGE));
    this.#informer.on(DELETE, this.updateStatus.bind(this, DELETE));
    this.#informer.on(ERROR, this.updateStatus.bind(this, ERROR));

    this.#informer.start().catch((err: unknown) => {
      console.error('Something went wrong while trying to start kubernetes informer', err);
    });
  }

  protected updateStatus(status: ADD | UPDATE | CHANGE | DELETE | ERROR, pod: V1Pod): void {
    if(!pod.metadata?.uid) throw new Error('invalid pod metadata');
    console.log(`received update status for ${pod.metadata.name}`, pod);

    if(status === DELETE) {
      this.#servers.delete(pod.metadata.uid);
      this.notify();
      return;
    }

    const server = this.fromV1Pod(pod);
    this.#servers.set(server.id, server);
    this.notify();
  }

  protected getLabels(): Record<string, string> {
    return {
      'creator': 'podman-ai-lab',
    }
  }

  protected getLabelSelector(): string {
    return (Object.entries(this.getLabels()).map(([key, value]) => `${key}=${value}`)).join(',')
  }

  protected getKubeConfig(): KubeConfig {
    const uri = kubernetes.getKubeconfig();
    const config = new KubeConfig();
    config.loadFromFile(uri.fsPath);
    console.debug(`current context ${config.getCurrentContext()}`);
    return config;
  }

  protected getCoreV1Api(): CoreV1Api {
    const config = this.getKubeConfig();
    return config.makeApiClient(CoreV1Api);
  }

  private refresh(): void {
    this.#servers.clear();
    this.#watchers.forEach(watcher => watcher.dispose());
    this.#informer?.stop().catch((err: unknown) => {
      console.error('Something went wrong while trying to stop kubernetes informer', err);
    })
    this.initInformer();
  }

  override dispose(): void {
    this.#servers.clear();
    this.#kubeConfigDisposable?.dispose();
    this.#watchers.forEach(watcher => watcher.dispose());

    this.#informer?.stop().catch((err) => {
      console.error('Something went wrong while trying to stop kubernetes informer', err);
    });
  }

  override getServers(): InferenceServerInstance[] {
    return Array.from(this.#servers.values());
  }

  protected async getVolumes(): Promise<V1PersistentVolumeClaim[]> {
    const coreAPI = this.getCoreV1Api();
    const result = await coreAPI.listNamespacedPersistentVolumeClaim(DEFAULT_NAMESPACE, undefined, undefined, undefined, undefined, this.getLabelSelector());
    return result.body.items;
  }

  protected async findModelVolume(modelId: string): Promise<V1PersistentVolumeClaim | undefined> {
    // get the volumes
    const volumes = await this.getVolumes();
    return volumes.find(volume => volume.metadata?.annotations && AI_LAB_ANNOTATIONS.MODEL in volume.metadata.annotations && volume.metadata.annotations[AI_LAB_ANNOTATIONS.MODEL] === modelId)
  }

  /**
   * Given a V1Pod create an InferenceServerInstance
   * @param pod
   * @protected
   */
  protected fromV1Pod(pod: V1Pod): InferenceServerInstance {
    if(!pod.metadata?.uid || !pod.metadata.name) throw new Error('invalid pod metadata');

    // get the model id from annotation and use ModelManager to get corresponding ModelInfo
    let modelInfo: ModelInfo | undefined = undefined;
    if(pod.metadata.annotations && AI_LAB_ANNOTATIONS.MODEL in pod.metadata.annotations) {
      const modelId = pod.metadata.annotations[AI_LAB_ANNOTATIONS.MODEL];
      modelInfo = this.modelManager.getModelInfo(modelId);
    }

    const name = pod.metadata.name;
    const coreAPI = this.getCoreV1Api();

    let status: InferenceServerStatus;
    switch(pod.status?.phase) {
      case 'Pending':
        status = 'starting';
        break;
      case 'Running':
        status = 'running';
          break;
      case 'Succeeded':
        status = 'stopped';
        break;
      default:
        status = 'error';
        break;
    }

    return {
      status: status,
      runtime: RuntimeType.KUBERNETES,
      id: pod.metadata.uid,
      type: InferenceType.LLAMA_CPP,
      container: {
        containerId: 'fake',
        engineId: 'fake',
      },
      models: modelInfo ? [modelInfo]:[],
      connection: {
        port: -1, // todo
      },
      health: undefined, // need to be formalized
      // utility
      stop: async () => {
        throw new Error('a kubernetes pod cannot be stopped')
      },
      start: async () => {
        throw new Error('a kubernetes pod cannot be started')
      },
      remove: async () => {
        await coreAPI.deleteNamespacedPod(name, DEFAULT_NAMESPACE);
      },
    }
  }

  /**
   * @param model
   * @protected
   */
  protected async createModelVolume(model: ModelInfo): Promise<V1PersistentVolumeClaim> {
    if(!model.memory) throw new Error('model need to have memory estimate');

    const volumeSize = Math.ceil(model.memory / (2 ** 30));

    const coreAPI = this.getCoreV1Api();
    const result = await coreAPI.createNamespacedPersistentVolumeClaim(DEFAULT_NAMESPACE, {
      metadata: {
        name: `pvc-podman-ai-lab-${getRandomString()}`,
        labels: this.getLabels(),
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
          }
        }
      }
    });
    return result.body;
  }

  override async create(config: InferenceServerConfig): Promise<InferenceServerInstance> {
    if(config.modelsInfo.length !== 1) throw new Error(`kubernetes inference creation does not support anything else than one model. (Got ${config.modelsInfo.length})`);

    const modelInfo = config.modelsInfo[0];
    if(!modelInfo.url) throw new Error('only remote models can be used.');

    // todo compute it live for imported models
    if(!modelInfo.sha256) throw new Error('models provided need a valid sha256 value.');

    console.log('creating volume'); // todo create task
    let volume = await this.findModelVolume(modelInfo.id);
    if(!volume) {
      volume = await this.createModelVolume(modelInfo);
    }

    if(!volume.metadata || !volume.metadata.name) throw new Error('invalid volume metadata.');

    const coreAPI = this.getCoreV1Api();

    const result = await coreAPI.createNamespacedPod(DEFAULT_NAMESPACE, {
      metadata: {
        name: `podman-ai-lab-inference-${getRandomString()}`,
        labels: this.getLabels(),
        annotations: {
          [AI_LAB_ANNOTATIONS.MODEL]: modelInfo.id,
        },
      },
      spec: {
        volumes: [{
          name: 'pvc-ai-lab-model',
          persistentVolumeClaim: {
            claimName: volume.metadata.name,
          }
        }],
        containers: [{
          name: 'nginx',
          image: 'nginx',
        }],
        // the init container is used to wait for the models to be available
        // ~this is hacky
        initContainers: [{
          name: 'init-model-checker',
          image: 'busybox',
          volumeMounts: [{
            mountPath: '/models',
            name: 'pvc-ai-lab-model',
          }],
          env: [{
            name: 'MODEL_URL',
            value: modelInfo.url,
          }, {
            name: 'MODEL_PATH',
            value: posix.join('/models', modelInfo.id),
          },{
            name: 'MODEL_SHA256',
            value: modelInfo.sha256,
          },{
            name: 'INIT_TIMEOUT',
            value: '3600' // default to one hour
          }],
          command: ['sh', '-c', file.replace(/\r\n/g, '\n')],
        }],
      }
    });

    return this.fromV1Pod(result.body);
  }
}
