import { provider, containerEngine, type ProviderContainerConnection, type ImageInfo } from '@podman-desktop/api';
import path from 'node:path';

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
    const imgs = await containerEngine.listImages();
    const images = imgs.filter(im => im.RepoTags && im.RepoTags.some(tag => tag === image));
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
}
