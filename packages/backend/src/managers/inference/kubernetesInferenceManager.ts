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
import { type Disposable, kubernetes, navigation } from '@podman-desktop/api';
import { type V1Pod, makeInformer, Informer, PortForward } from '@kubernetes/client-node';
import { ModelInfo } from '@shared/src/models/IModelInfo';
import { ADD, CHANGE, DELETE, ERROR, UPDATE } from '@kubernetes/client-node';
import { ModelsManager } from '../modelsManager';
import { createServer, Server as ProxyServer, Socket } from 'net';
import {
  getCoreV1Api,
  getKubeConfig,
  getLabelSelector,
  KubernetesInferenceProvider,
} from '../../workers/provider/KubernetesInferenceProvider';
import { getInferenceType } from '../../utils/inferenceUtils';
import { InferenceProviderRegistry } from '../../registries/InferenceProviderRegistry';

export const DEFAULT_NAMESPACE = 'default';

export enum AI_LAB_ANNOTATIONS {
  MODEL = 'podman-ai-lab-model',
  PORT = 'podman-ai-lab-port',
}

export interface KubernetesInferenceDetails {
  namespace: string;
  context: string;
}

export class KubernetesInferenceManager extends RuntimeEngine<KubernetesInferenceDetails> {
  #servers: Map<string, InferenceServerInstance<KubernetesInferenceDetails>>;
  #kubeConfigDisposable: Disposable | undefined;
  #informer: Informer<V1Pod> | undefined;
  #watchers: Disposable[];
  // related to port forwards
  #proxies: Map<string, { server: ProxyServer; sockets: Socket[] }>;

  constructor(
    taskRegistry: TaskRegistry,
    private modelManager: ModelsManager,
    private inferenceProviderRegistry: InferenceProviderRegistry,
  ) {
    super('kubernetes', RuntimeType.KUBERNETES, taskRegistry);

    this.#servers = new Map();
    this.#watchers = [];
    this.#proxies = new Map();
  }

  override init(): void {
    this.#kubeConfigDisposable = kubernetes.onDidUpdateKubeconfig(() => {
      this.refresh();
    });

    this.initInformer();
  }

  protected initInformer(): void {
    const coreApi = getCoreV1Api();

    const listFn = () => coreApi.listNamespacedPod(DEFAULT_NAMESPACE);
    this.#informer = makeInformer(
      getKubeConfig(),
      `/api/v1/namespaces/${DEFAULT_NAMESPACE}/pods`,
      listFn,
      getLabelSelector(),
    );
    this.#informer.on(ADD, this.updateStatus.bind(this, ADD));
    this.#informer.on(UPDATE, this.updateStatus.bind(this, UPDATE));
    this.#informer.on(CHANGE, this.updateStatus.bind(this, CHANGE));
    this.#informer.on(DELETE, this.updateStatus.bind(this, DELETE));
    this.#informer.on(ERROR, this.updateStatus.bind(this, ERROR));

    this.#informer.start().catch((err: unknown) => {
      console.error('Something went wrong while trying to start kubernetes informer', err);
    });
  }

  protected clearProxy(serverId: string): void {
    console.log(`clearProxy ${serverId}`);
    const proxy = this.#proxies.get(serverId);
    if (proxy) {
      proxy.server.close((err: unknown) => {
        console.error(`Something went wrong while trying to close proxy for serverId ${serverId}`, err);
      });
      proxy.sockets.forEach(socket => socket.destroy());
      this.#proxies.delete(serverId);
    }
  }

  /**
   * @remark /!\ Does not clear the corresponding proxy
   * @param serverId
   * @protected
   */
  protected clearServer(serverId: string): void {
    const server = this.#servers.get(serverId);
    if (!server) return;

    this.#servers.delete(serverId);
    this.notify();
  }

  protected clearServers(): void {
    this.getServers().forEach(server => this.clearServer(server.id));
    this.#servers.clear();
  }

  protected updateStatus(status: ADD | UPDATE | CHANGE | DELETE | ERROR, pod: V1Pod): void {
    if (!pod.metadata?.uid) throw new Error('invalid pod metadata');

    if (status === DELETE) {
      // clear corresponding proxy
      this.clearProxy(pod.metadata.uid);
      // clear server
      this.clearServer(pod.metadata.uid);
      return;
    }

    const server = this.fromV1Pod(pod);
    this.#servers.set(server.id, server);
    this.notify();
  }

  private refresh(): void {
    this.clearServers();

    this.#watchers.forEach(watcher => watcher.dispose());
    this.#informer
      ?.stop()
      .catch((err: unknown) => {
        console.error('Something went wrong while trying to stop kubernetes informer', err);
      })
      .finally(() => {
        this.initInformer();
      });
  }

  /**
   * Given a pod, return a ProxyServer
   * @param pod
   * @protected
   */
  protected createProxy(pod: V1Pod): ProxyServer {
    if (!pod.metadata || !pod.metadata.name) throw new Error('invalid pod metadata');

    const podName = pod.metadata.name;
    const targetPorts: number[] = [];
    for (let container of pod.spec?.containers ?? []) {
      targetPorts.push(...(container.ports ?? []).map(value => value.containerPort));
    }
    const forward = new PortForward(getKubeConfig());
    return createServer(socket => {
      forward.portForward(DEFAULT_NAMESPACE, podName, targetPorts, socket, null, socket).catch((err: unknown) => {
        console.error(`Something went wrong while trying to port forward pod ${podName}`, err);
      });
    });
  }

  override dispose(): void {
    // closing all proxies
    Array.from(this.#proxies.keys()).forEach(id => this.clearProxy(id));

    this.#servers.clear();
    this.#kubeConfigDisposable?.dispose();
    this.#watchers.forEach(watcher => watcher.dispose());

    this.#informer?.stop().catch(err => {
      console.error('Something went wrong while trying to stop kubernetes informer', err);
    });
  }

  override getServers(): InferenceServerInstance<KubernetesInferenceDetails>[] {
    return Array.from(this.#servers.values());
  }

  /**
   * Given a V1Pod create an InferenceServerInstance
   * @param pod
   * @protected
   */
  protected fromV1Pod(pod: V1Pod): InferenceServerInstance<KubernetesInferenceDetails> {
    if (!pod.metadata?.uid || !pod.metadata.name) throw new Error('invalid pod metadata');

    // get the model id from annotation and use ModelManager to get corresponding ModelInfo
    let modelInfo: ModelInfo | undefined = undefined;
    if (pod.metadata.annotations && AI_LAB_ANNOTATIONS.MODEL in pod.metadata.annotations) {
      const modelId = pod.metadata.annotations[AI_LAB_ANNOTATIONS.MODEL];
      modelInfo = this.modelManager.getModelInfo(modelId);
    }

    const name = pod.metadata.name;
    const coreAPI = getCoreV1Api();

    let status: InferenceServerStatus;
    switch (pod.status?.phase) {
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

    // ref https://github.com/kubernetes/kubernetes/issues/22839#issuecomment-339106985
    if (pod.metadata.deletionTimestamp) {
      status = 'deleting';
    }

    let healthStatus: string | undefined;
    if (pod.status && pod.status.containerStatuses && pod.status.containerStatuses.length === 1) {
      healthStatus = pod.status.containerStatuses[0].state?.running ? 'healthy' : undefined;
    }

    // we try to reuse the port provided when creating the inference server
    // it has been saved to the AI_LAB_ANNOTATIONS.PORT annotation
    let localPort: number | undefined = undefined;
    if (pod.metadata.annotations && AI_LAB_ANNOTATIONS.PORT in pod.metadata.annotations) {
      localPort = parseInt(pod.metadata.annotations[AI_LAB_ANNOTATIONS.PORT]);
    } else {
      throw new Error('pod has missing PORT annotation: cannot create a proxy');
    }

    // create a proxy server
    const serverId = pod.metadata.uid;
    if (!this.#proxies.has(serverId)) {
      console.log(`proxy does not exist for pod ${serverId}: creating`);

      // create a proxy server used for port forwarding
      const server = this.createProxy(pod);
      this.#proxies.set(serverId, {
        server: server,
        sockets: [],
      });

      // capture new socket created to be able to destroy them on disposal
      server.on('connection', (socket: Socket) => {
        const proxy = this.#proxies.get(serverId);
        if (!proxy) {
          socket.destroy(new Error('proxy is not defined'));
          throw new Error('proxy is undefined destroying socket');
        }

        this.#proxies.set(serverId, {
          server: proxy.server,
          sockets: [...proxy.sockets, socket],
        });
      });
      // start listening
      server.listen(localPort, '127.0.0.1');
    } else {
      console.warn(`the pod ${serverId} already has a proxy defined.`);
    }

    return {
      status: status,
      runtime: RuntimeType.KUBERNETES,
      id: pod.metadata.uid,
      type: InferenceType.LLAMA_CPP,
      details: {
        namespace: DEFAULT_NAMESPACE,
        context: getKubeConfig().getCurrentContext(),
      },
      models: modelInfo ? [modelInfo] : [],
      connection: {
        port: localPort,
        host: '127.0.0.1',
      },
      health: healthStatus
        ? {
            Status: healthStatus,
            Log: [],
            FailingStreak: 0,
          }
        : undefined, // need to be formalized
      // utility
      stop: async () => {
        throw new Error('a kubernetes pod cannot be stopped');
      },
      start: async () => {
        throw new Error('a kubernetes pod cannot be started');
      },
      remove: async () => {
        await coreAPI.deleteNamespacedPod(name, DEFAULT_NAMESPACE);
      },
      navigate: () => navigation.navigateToPod('kubernetes', name, 'kubernetes'),
    };
  }

  override async create(config: InferenceServerConfig): Promise<InferenceServerInstance<KubernetesInferenceDetails>> {
    // Get the backend for the model inference server {@link InferenceType}
    const backend: InferenceType = getInferenceType(config.modelsInfo);

    let provider: KubernetesInferenceProvider;
    if (config.inferenceProvider) {
      provider = this.inferenceProviderRegistry.get<KubernetesInferenceProvider>(
        RuntimeType.KUBERNETES,
        config.inferenceProvider,
      );
      if (!provider.enabled()) throw new Error('provider requested is not enabled.');
    } else {
      const providers: KubernetesInferenceProvider[] = this.inferenceProviderRegistry
        .getByType<KubernetesInferenceProvider>(RuntimeType.KUBERNETES, backend)
        .filter(provider => provider.enabled());
      if (providers.length === 0) throw new Error('no enabled provider could be found.');
      provider = providers[0];
    }

    const pod = await provider.perform(config);
    return this.fromV1Pod(pod);
  }
}
