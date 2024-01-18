import {
  provider,
  containerEngine,
  type Webview,
  type ProviderContainerConnection,
  type ImageInfo,
} from '@podman-desktop/api';
import type { LocalModelInfo } from '@shared/src/models/ILocalModelInfo';
import type { ModelResponse } from '@shared/src/models/IModelResponse';

import path from 'node:path';
import * as http from 'node:http';
import { getFreePort } from '../utils/ports';
import type { QueryState } from '@shared/src/models/IPlaygroundQueryState';
import { MSG_NEW_PLAYGROUND_QUERIES_STATE } from '@shared/Messages';

const LOCALAI_IMAGE = 'quay.io/go-skynet/local-ai:v2.5.1';

function findFirstProvider(): ProviderContainerConnection | undefined {
  const engines = provider
    .getContainerConnections()
    .filter(connection => connection.connection.type === 'podman')
    .filter(connection => connection.connection.status() == 'started');
  return engines.length > 0 ? engines[0] : undefined;
}

export interface PlaygroundState {
  containerId: string;
  port: number;
}

export class PlayGroundManager {
  private queryIdCounter = 0;

  private playgrounds: Map<string, PlaygroundState>;
  private queries: Map<number, QueryState>;

  constructor(private webview: Webview) {
    this.playgrounds = new Map<string, PlaygroundState>();
    this.queries = new Map<number, QueryState>();
  }

  async selectImage(connection: ProviderContainerConnection, image: string): Promise<ImageInfo | undefined> {
    const images = (await containerEngine.listImages()).filter(im => im.RepoTags?.some(tag => tag === image));
    return images.length > 0 ? images[0] : undefined;
  }

  async startPlayground(modelId: string, modelPath: string): Promise<string> {
    // TODO(feloy) remove previous query from state?

    if (this.playgrounds.has(modelId)) {
      throw new Error('model is already running');
    }
    const connection = findFirstProvider();
    if (!connection) {
      throw new Error('Unable to find an engine to start playground');
    }

    let image = await this.selectImage(connection, LOCALAI_IMAGE);
    if (!image) {
      await containerEngine.pullImage(connection.connection, LOCALAI_IMAGE, () => {});
      image = await this.selectImage(connection, LOCALAI_IMAGE);
      if (!image) {
        throw new Error(`Unable to find ${LOCALAI_IMAGE} image`);
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
        PortBindings: {
          '8080/tcp': [
            {
              HostPort: '' + freePort,
            },
          ],
        },
      },
      Cmd: ['--models-path', '/models', '--context-size', '700', '--threads', '4'],
    });
    this.playgrounds.set(modelId, {
      containerId: result.id,
      port: freePort,
    });
    return result.id;
  }

  async stopPlayground(playgroundId: string): Promise<void> {
    const connection = findFirstProvider();
    if (!connection) {
      throw new Error('Unable to find an engine to start playground');
    }
    return containerEngine.stopContainer(connection.providerId, playgroundId);
  }

  async askPlayground(modelInfo: LocalModelInfo, prompt: string): Promise<number> {
    const state = this.playgrounds.get(modelInfo.id);
    if (!state) {
      throw new Error('model is not running');
    }

    const query = {
      id: this.getNextQueryId(),
      modelId: modelInfo.id,
      prompt: prompt,
    } as QueryState;

    const post_data = JSON.stringify({
      model: modelInfo.file,
      prompt: prompt,
      temperature: 0.7,
    });

    const post_options: http.RequestOptions = {
      host: 'localhost',
      port: '' + state.port,
      path: '/v1/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const post_req = http.request(post_options, res => {
      res.setEncoding('utf8');
      const chunks = [];
      res.on('data', data => chunks.push(data));
      res.on('end', () => {
        const resBody = chunks.join();
        if (res.headers['content-type'] === 'application/json') {
          const result = JSON.parse(resBody);
          const q = this.queries.get(query.id);
          if (!q) {
            throw new Error('query not found in state');
          }
          q.response = result as ModelResponse;
          this.queries.set(query.id, q);
          this.sendState().catch((err: unknown) => {
            console.error('playground: unable to send the response to the frontend', err);
          });
        }
      });
    });
    // post the data
    post_req.write(post_data);
    post_req.end();

    this.queries.set(query.id, query);
    await this.sendState();
    return query.id;
  }

  getNextQueryId() {
    return ++this.queryIdCounter;
  }
  getState(): QueryState[] {
    return Array.from(this.queries.values());
  }
  async sendState() {
    await this.webview.postMessage({
      id: MSG_NEW_PLAYGROUND_QUERIES_STATE,
      body: this.getState(),
    });
  }
}
