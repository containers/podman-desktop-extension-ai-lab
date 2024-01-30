import { beforeEach, expect, test, vi } from 'vitest';
import { PlayGroundManager } from './playground';
import type { ImageInfo, Webview } from '@podman-desktop/api';

const mocks = vi.hoisted(() => ({
  postMessage: vi.fn(),
  getContainerConnections: vi.fn(),
  pullImage: vi.fn(),
  createContainer: vi.fn(),
  stopContainer: vi.fn(),
  getFreePort: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    provider: {
      getContainerConnections: mocks.getContainerConnections,
    },
    containerEngine: {
      pullImage: mocks.pullImage,
      createContainer: mocks.createContainer,
      stopContainer: mocks.stopContainer,
    },
  };
});

vi.mock('../utils/ports', async () => {
  return {
    getFreePort: mocks.getFreePort,
  };
});

let manager: PlayGroundManager;

beforeEach(() => {
  vi.resetAllMocks();

  manager = new PlayGroundManager({
    postMessage: mocks.postMessage,
  } as unknown as Webview);
});

test('startPlayground should fail if no provider', async () => {
  mocks.getContainerConnections.mockReturnValue([]);
  await expect(manager.startPlayground('model1', '/path/to/model')).rejects.toThrowError(
    'Unable to find an engine to start playground',
  );
});

test('startPlayground should download image if not present then create container', async () => {
  mocks.getContainerConnections.mockReturnValue([
    {
      connection: {
        type: 'podman',
        status: () => 'started',
      },
    },
  ]);
  vi.spyOn(manager, 'selectImage')
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce({
      Id: 'image1',
      engineId: 'engine1',
    } as ImageInfo);
  mocks.createContainer.mockReturnValue({
    id: 'container1',
  });
  mocks.getFreePort.mockResolvedValue(8085);
  await manager.startPlayground('model1', '/path/to/model');
  expect(mocks.pullImage).toHaveBeenCalledOnce();
  expect(mocks.createContainer).toHaveBeenNthCalledWith(1, 'engine1', {
    Cmd: ['--models-path', '/models', '--context-size', '700', '--threads', '4'],
    Detach: true,
    Env: ['MODEL_PATH=/models/model'],
    ExposedPorts: {
      '8085': {},
    },
    HostConfig: {
      AutoRemove: true,
      Mounts: [
        {
          Source: '/path/to',
          Target: '/models',
          Type: 'bind',
        },
      ],
      PortBindings: {
        '8000/tcp': [
          {
            HostPort: '8085',
          },
        ],
      },
    },
    Image: 'image1',
    Labels: {
      'ia-studio-model': 'model1',
    },
  });
});

test('stopPlayground should fail if no playground is running', async () => {
  await expect(manager.stopPlayground('unknown-model')).rejects.toThrowError('model is not running');
});

test('stopPlayground should stop a started playground', async () => {
  mocks.getContainerConnections.mockReturnValue([
    {
      connection: {
        type: 'podman',
        status: () => 'started',
      },
    },
  ]);
  vi.spyOn(manager, 'selectImage').mockResolvedValue({
    Id: 'image1',
    engineId: 'engine1',
  } as ImageInfo);
  mocks.createContainer.mockReturnValue({
    id: 'container1',
  });
  mocks.stopContainer.mockResolvedValue(undefined);
  mocks.getFreePort.mockResolvedValue(8085);
  await manager.startPlayground('model1', '/path/to/model');
  await manager.stopPlayground('model1');
  expect(mocks.stopContainer).toHaveBeenNthCalledWith(1, 'engine1', 'container1');
});
