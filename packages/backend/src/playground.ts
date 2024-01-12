import { provider, containerEngine, type ProviderContainerConnection, type ImageInfo } from '@podman-desktop/api';
import { LocalModelInfo } from '@shared/models/ILocalModelInfo';
import { ModelResponse } from '@shared/models/IModelResponse';

import path from 'node:path';
import * as http from 'node:http';

const LOCALAI_IMAGE = 'quay.io/go-skynet/local-ai:v2.5.1';

function findFirstProvider(): ProviderContainerConnection | undefined {
  const engines = provider
    .getContainerConnections()
    .filter(connection => connection.connection.type === 'podman')
    .filter(connection => connection.connection.status() == 'started');
  return engines.length > 0 ? engines[0] : undefined;
}

export class PlayGroundManager {
  async selectImage(connection: ProviderContainerConnection, image: string): Promise<ImageInfo | undefined> {
    const images = (await containerEngine.listImages()).filter(im => im.RepoTags && im.RepoTags.some(tag => tag === image));
    return images.length > 0 ? images[0] : undefined;
  }

  async startPlayground(modelId: string, modelPath: string): Promise<string> {
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
    const result = await containerEngine.createContainer(image.engineId, {
      Image: image.Id,
      Detach: true,
      ExposedPorts: { '9000': {} },
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
              HostPort: '9000'
            }
          ]
        }
      },
      Cmd: ['--models-path', '/models', '--context-size', '700', '--threads', '4'],
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

  async askPlayground(modelInfo: LocalModelInfo, prompt: string): Promise<ModelResponse> {
    return new Promise(resolve => {
      var post_data = JSON.stringify({
        "model": modelInfo.file,
        "prompt": prompt,
        "temperature": 0.7
      });

      var post_options: http.RequestOptions = {
        host: 'localhost',
        port: '9000',
        path: '/v1/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      var post_req = http.request(post_options, function (res) {
        res.setEncoding('utf8');
        const chunks = [];
        res.on('data', (data) => chunks.push(data));
        res.on('end', () => {
          let resBody = chunks.join();
          switch (res.headers['content-type']) {
            case 'application/json':
              const result = JSON.parse(resBody);
              console.log('result', result);
              resolve(result as ModelResponse);
              break;
          }
        });
      });
      // post the data
      post_req.write(post_data);
      post_req.end();
    });
  }
}
