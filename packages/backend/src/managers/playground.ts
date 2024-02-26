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

import { containerEngine, type Webview, type ImageInfo, type TelemetryLogger } from '@podman-desktop/api';

import path from 'node:path';
import { getFreePort } from '../utils/ports';
import type { QueryState } from '@shared/src/models/IPlaygroundQueryState';
import { Messages } from '@shared/Messages';
import type { PlaygroundState, PlaygroundStatus } from '@shared/src/models/IPlaygroundState';
import type { ContainerRegistry } from '../registries/ContainerRegistry';
import type { PodmanConnection } from './podmanConnection';
import OpenAI from 'openai';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION, getDurationSecondsSince, timeout } from '../utils/utils';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { getFirstRunningPodmanConnection } from '../utils/podman';

export const LABEL_MODEL_ID = 'ai-studio-model-id';
export const LABEL_MODEL_PORT = 'ai-studio-model-port';
export const LABEL_MODEL_PORTS = 'ai-studio-model-ports';

// TODO: this should not be hardcoded
const PLAYGROUND_IMAGE = 'quay.io/bootsy/playground:v0';

const STARTING_TIME_MAX = 3600 * 1000;

export class PlayGroundManager {
  private queryIdCounter = 0;

  // Dict modelId => state
  private playgrounds: Map<string, PlaygroundState>;
  private queries: Map<number, QueryState>;

  constructor(
    private webview: Webview,
    private containerRegistry: ContainerRegistry,
    private podmanConnection: PodmanConnection,
    private telemetry: TelemetryLogger,
  ) {
    this.playgrounds = new Map<string, PlaygroundState>();
    this.queries = new Map<number, QueryState>();
  }

  adoptRunningPlaygrounds() {
    this.podmanConnection.startupSubscribe(() => {
      containerEngine
        .listContainers()
        .then(containers => {
          const playgroundContainers = containers.filter(
            c => LABEL_MODEL_ID in c.Labels && LABEL_MODEL_PORT in c.Labels && c.State === 'running',
          );
          for (const containerToAdopt of playgroundContainers) {
            const modelId = containerToAdopt.Labels[LABEL_MODEL_ID];
            if (this.playgrounds.has(modelId)) {
              continue;
            }
            const modelPort = parseInt(containerToAdopt.Labels[LABEL_MODEL_PORT], 10);
            if (isNaN(modelPort)) {
              continue;
            }
            const state: PlaygroundState = {
              modelId,
              status: 'running',
              container: {
                containerId: containerToAdopt.Id,
                engineId: containerToAdopt.engineId,
                port: modelPort,
              },
            };
            this.updatePlaygroundState(modelId, state);
          }
        })
        .catch((err: unknown) => {
          console.error('error during adoption of existing playground containers', err);
        });
    });
    this.podmanConnection.onMachineStop(() => {
      // Podman Machine has been stopped, we consider all playground containers are stopped
      this.playgrounds.clear();
      this.sendPlaygroundState();
    });
  }

  async selectImage(image: string): Promise<ImageInfo | undefined> {
    const images = (await containerEngine.listImages()).filter(im => im.RepoTags?.some(tag => tag === image));
    return images.length > 0 ? images[0] : undefined;
  }

  setPlaygroundStatus(modelId: string, status: PlaygroundStatus): void {
    this.updatePlaygroundState(modelId, {
      modelId: modelId,
      ...(this.playgrounds.get(modelId) || {}),
      status: status,
    });
  }

  setPlaygroundError(modelId: string, error: string): void {
    const state: Partial<PlaygroundState> = this.playgrounds.get(modelId) || {};
    this.updatePlaygroundState(modelId, {
      modelId: modelId,
      ...state,
      status: 'error',
      error: state.error ?? error, // we never overwrite previous error - we want to keep the first one raised
    });
  }

  updatePlaygroundState(modelId: string, state: PlaygroundState): void {
    this.playgrounds.set(modelId, {
      ...state,
      error: state.status === 'error' ? state.error : undefined, // clearing error when status not error
    });
    this.sendPlaygroundState();
  }

  sendPlaygroundState() {
    this.webview
      .postMessage({
        id: Messages.MSG_PLAYGROUNDS_STATE_UPDATE,
        body: this.getPlaygroundsState(),
      })
      .catch((err: unknown) => {
        console.error(`Something went wrong while emitting MSG_PLAYGROUNDS_STATE_UPDATE: ${String(err)}`);
      });
  }

  async startPlayground(modelId: string, modelPath: string): Promise<string> {
    const startTime = performance.now();
    // TODO(feloy) remove previous query from state?
    if (this.playgrounds.has(modelId)) {
      // TODO: check manually if the contains has a matching state
      switch (this.playgrounds.get(modelId).status) {
        case 'running':
          throw new Error('playground is already running');
        case 'starting':
        case 'stopping':
          throw new Error('playground is transitioning');
        case 'error':
        case 'none':
        case 'stopped':
          break;
      }
    }

    this.setPlaygroundStatus(modelId, 'starting');

    const connection = await getFirstRunningPodmanConnection();
    if (!connection) {
      const error = 'Unable to find an engine to start playground';
      this.setPlaygroundError(modelId, error);
      this.telemetry.logError('playground.start', {
        'model.id': modelId,
        message: error,
      });
      throw new Error(error);
    }

    let image = await this.selectImage(PLAYGROUND_IMAGE);
    if (!image) {
      await containerEngine.pullImage(connection.connection, PLAYGROUND_IMAGE, () => {});
      image = await this.selectImage(PLAYGROUND_IMAGE);
      if (!image) {
        const error = `Unable to find ${PLAYGROUND_IMAGE} image`;
        this.setPlaygroundError(modelId, error);
        this.telemetry.logError('playground.start', {
          'model.id': modelId,
          message: 'unable to find playground image',
        });
        throw new Error(error);
      }
    }

    const freePort = await getFreePort();
    const result = await containerEngine.createContainer(image.engineId, {
      Image: image.Id,
      Detach: true,
      ExposedPorts: { ['' + freePort]: {} },
      HostConfig: {
        AutoRemove: true,
        Mounts: [
          {
            Target: '/models',
            Source: path.dirname(modelPath),
            Type: 'bind',
          },
        ],
        SecurityOpt: [DISABLE_SELINUX_LABEL_SECURITY_OPTION],
        PortBindings: {
          '8000/tcp': [
            {
              HostPort: '' + freePort,
            },
          ],
        },
      },
      Labels: {
        [LABEL_MODEL_ID]: modelId,
        [LABEL_MODEL_PORT]: `${freePort}`,
      },
      Env: [`MODEL_PATH=/models/${path.basename(modelPath)}`],
      Cmd: ['--models-path', '/models', '--context-size', '700', '--threads', '4'],
    });

    const disposable = this.containerRegistry.subscribe(result.id, (status: string) => {
      switch (status) {
        case 'remove':
        case 'die':
        case 'cleanup':
          // Update the playground state accordingly
          this.updatePlaygroundState(modelId, {
            status: 'none',
            modelId,
          });
          disposable.dispose();
          break;
      }
    });

    let contacted = false;
    const start = Date.now();
    while (
      Date.now() - start < STARTING_TIME_MAX &&
      !contacted &&
      this.playgrounds.get(modelId).status === 'starting'
    ) {
      try {
        await fetch(`http://localhost:${freePort}`);
        contacted = true;
      } catch (err: unknown) {
        await timeout(1000);
      }
    }

    if (!contacted) {
      await containerEngine.stopContainer(image.engineId, result.id);
      throw new Error(`Can't start playground for model ${modelId}`);
    }

    this.updatePlaygroundState(modelId, {
      container: {
        containerId: result.id,
        port: freePort,
        engineId: image.engineId,
      },
      status: 'running',
      modelId,
    });

    const durationSeconds = getDurationSecondsSince(startTime);
    this.telemetry.logUsage('playground.start', { 'model.id': modelId, durationSeconds });
    return result.id;
  }

  async stopPlayground(modelId: string): Promise<void> {
    const startTime = performance.now();
    const state = this.playgrounds.get(modelId);
    if (state?.container === undefined) {
      throw new Error('model is not running');
    }
    this.setPlaygroundStatus(modelId, 'stopping');
    // We do not await since it can take a lot of time
    containerEngine
      .stopContainer(state.container.engineId, state.container.containerId)
      .then(async () => {
        this.setPlaygroundStatus(modelId, 'stopped');
      })
      .catch(async (error: unknown) => {
        console.error(error);
        this.setPlaygroundError(modelId, `Something went wrong while stopping playground: ${String(error)}`);
        this.telemetry.logError('playground.stop', {
          'model.id': modelId,
          message: 'error stopping playground',
          error: error,
        });
      });
    const durationSeconds = getDurationSecondsSince(startTime);
    this.telemetry.logUsage('playground.stop', { 'model.id': modelId, durationSeconds });
  }

  async askPlayground(modelInfo: ModelInfo, prompt: string): Promise<number> {
    const startTime = performance.now();
    const state = this.playgrounds.get(modelInfo.id);
    if (state?.container === undefined) {
      this.telemetry.logError('playground.ask', { 'model.id': modelInfo.id, message: 'model is not running' });
      throw new Error('model is not running');
    }

    const query: QueryState = {
      id: this.getNextQueryId(),
      modelId: modelInfo.id,
      prompt: prompt,
    };

    const client = new OpenAI({ baseURL: `http://localhost:${state.container.port}/v1`, apiKey: 'dummy' });

    const response = await client.completions.create({
      model: modelInfo.file.file,
      prompt,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });

    this.queries.set(query.id, query);
    this.sendQueriesState();

    (async () => {
      for await (const chunk of response) {
        query.error = undefined;
        if (query.response) {
          query.response.choices = query.response.choices.concat(chunk.choices);
        } else {
          query.response = chunk;
        }
        if (query.response.choices.some(choice => choice.finish_reason)) {
          const responseDurationSeconds = getDurationSecondsSince(startTime);
          this.telemetry.logUsage('playground.ask', { 'model.id': modelInfo.id, responseDurationSeconds });
        }
        this.sendQueriesState();
      }
    })().catch((err: unknown) => console.warn(`Error while reading streamed response for model ${modelInfo.id}`, err));
    const durationSeconds = getDurationSecondsSince(startTime);
    this.telemetry.logUsage('playground.ask', { 'model.id': modelInfo.id, durationSeconds });
    return query.id;
  }

  getNextQueryId() {
    return ++this.queryIdCounter;
  }
  getQueriesState(): QueryState[] {
    return Array.from(this.queries.values());
  }

  getPlaygroundsState(): PlaygroundState[] {
    return Array.from(this.playgrounds.values());
  }

  sendQueriesState(): void {
    this.webview
      .postMessage({
        id: Messages.MSG_NEW_PLAYGROUND_QUERIES_STATE,
        body: this.getQueriesState(),
      })
      .catch((err: unknown) => {
        console.error(`Something went wrong while emitting MSG_NEW_PLAYGROUND_QUERIES_STATE: ${String(err)}`);
      });
  }
}
