/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import '@testing-library/jest-dom/vitest';
import { assert, beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import StartLlamaStackContainer from '/@/pages/llama-stack/StartLlamaStackContainer.svelte';
import { llamaStackClient, studioClient } from '/@/utils/client';
import type { ContainerProviderConnectionInfo } from '@shared/models/IContainerConnectionInfo';
import { LLAMA_STACK_CONTAINER_TRACKINGID } from '@shared/models/llama-stack/LlamaStackContainerInfo';
import { VMType } from '@shared/models/IPodman';
import userEvent from '@testing-library/user-event';
import * as tasks from '/@/stores/tasks';
import type { Task } from '@shared/models/ITask';
import { writable } from 'svelte/store';
import { tick } from 'svelte';

vi.mock('../../stores/tasks', async () => {
  return {
    tasks: vi.fn(),
  };
});

const getContainerConnectionInfoMock = vi.fn();

vi.mock('../../stores/containerProviderConnections', () => ({
  containerProviderConnections: {
    subscribe: (f: (msg: unknown) => void) => {
      f(getContainerConnectionInfoMock());
      return (): void => {};
    },
  },
}));

vi.mock('../../utils/client', async () => ({
  llamaStackClient: {
    getLlamaStackContainersInfo: vi.fn(),
    routeToLlamaStackContainerTerminal: vi.fn().mockResolvedValue(undefined),
    requestcreateLlamaStackContainerss: vi.fn(),
  },
  studioClient: {
    openURL: vi.fn().mockResolvedValue(true),
  },
  rpcBrowser: {
    subscribe: (): unknown => {
      return {
        unsubscribe: (): void => {},
      };
    },
  },
}));

const containerProviderConnection: ContainerProviderConnectionInfo = {
  name: 'Dummy container connection provider',
  status: 'started',
  type: 'podman',
  vmType: VMType.QEMU,
  providerId: 'podman',
};

beforeEach(() => {
  getContainerConnectionInfoMock.mockReturnValue([containerProviderConnection]);
  vi.mocked(tasks).tasks = writable([]);
});

test('start button should be displayed if no Llama Stack container', async () => {
  render(StartLlamaStackContainer);

  const startBtn = screen.getByTitle('Start Llama Stack container');
  expect(startBtn).toBeDefined();
});

test('Instructions block should not be displayed if no Llama Stack container', async () => {
  render(StartLlamaStackContainer);

  await tick();
  const instructions = screen.queryByText('Instructions');
  expect(instructions).not.toBeInTheDocument();
});

test('Instructions block should be displayed if Llama Stack container is found', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'containerId', port: 10000, state: 'running' },
    playground: undefined,
  });
  render(StartLlamaStackContainer);

  await vi.waitFor(() => screen.getByText('Instructions'));
});

test('start button should be displayed and enabled', async () => {
  render(StartLlamaStackContainer);

  const startBtn = screen.getByTitle('Start Llama Stack container');
  expect(startBtn).toBeDefined();
  expect(startBtn).toBeEnabled();
});

test('open button should be displayed if Llama Stack container is found', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'containerId', port: 10000, state: 'running' },
    playground: { containerId: 'playgroundId', port: 5000, state: 'running' },
  });
  render(StartLlamaStackContainer);

  await vi.waitFor(() => {
    const openBtn = screen.getByTitle('Open Llama Stack Server container');
    expect(openBtn).toBeDefined();
  });
});

test('playground button should be disabled if playground port is not available', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'containerId', port: 10000, state: 'running' },
    playground: { containerId: 'playgroundId', port: 5000, state: 'running' },
  });
  render(StartLlamaStackContainer);

  await vi.waitFor(() => {
    const playgroundBtn = screen.getByTitle('Explore LLama-Stack environment');
    expect(playgroundBtn).toBeDefined();
    expect(playgroundBtn).toBeEnabled();
  });
});

test('playground button should be enabled if playground port is present', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'containerId', port: 10000, state: 'running' },
    playground: { containerId: 'pgId', port: 10001, state: 'running' },
  });
  render(StartLlamaStackContainer);

  await vi.waitFor(() => {
    const playgroundBtn = screen.getByTitle('Explore LLama-Stack environment');
    expect(playgroundBtn).toBeDefined();
    expect(playgroundBtn).toBeEnabled();
  });
});

test('click playground button should open url', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'containerId', port: 10000, state: 'running' },
    playground: { containerId: 'pgId', port: 10001, state: 'running' },
  });
  render(StartLlamaStackContainer);

  const playgroundBtn = await vi.waitFor(() => {
    const playgroundBtn = screen.getByTitle('Explore LLama-Stack environment');
    expect(playgroundBtn).toBeDefined();
    return playgroundBtn;
  });

  await userEvent.click(playgroundBtn);
  expect(studioClient.openURL).toHaveBeenCalledWith('http://localhost:10001');
});

test('click open button should redirect to Llama Stack server container', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'containerId', port: 10000, state: 'running' },
    playground: { containerId: 'playgroundId', port: 5000, state: 'running' },
  });
  render(StartLlamaStackContainer);

  const openBtn = await vi.waitFor(() => {
    const openBtn = screen.getByTitle('Open Llama Stack Server container');
    expect(openBtn).toBeDefined();
    return openBtn;
  });

  await userEvent.click(openBtn);
  expect(llamaStackClient.routeToLlamaStackContainerTerminal).toHaveBeenCalledWith('containerId');
});

test('port should be displayed', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'containerId', port: 10000, state: 'running' },
    playground: undefined,
  });
  render(StartLlamaStackContainer);

  await vi.waitFor(() => {
    screen.getByText(/http:\/\/localhost:10000/);
  });
});

test('link to Swagger UI should be displayed', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'containerId', port: 10000, state: 'running' },
    playground: undefined,
  });
  render(StartLlamaStackContainer);

  let link: HTMLElement | undefined;
  await vi.waitFor(() => {
    link = screen.getByText('swagger documentation');
  });
  assert(link, 'link should be defined');
  await fireEvent.click(link);
  expect(studioClient.openURL).toHaveBeenCalledWith('http://localhost:10000/docs');
});

test('click start button triggers requestcreateLlamaStackContainerss', async () => {
  vi.mocked(llamaStackClient.requestcreateLlamaStackContainerss).mockResolvedValue(undefined);

  render(StartLlamaStackContainer);

  const startBtn = await screen.findByTitle('Start Llama Stack container');
  await userEvent.click(startBtn);

  expect(llamaStackClient.requestcreateLlamaStackContainerss).toHaveBeenCalledWith({
    connection: containerProviderConnection,
  });
});

test('displays error if requestcreateLlamaStackContainerss throws', async () => {
  vi.mocked(llamaStackClient.requestcreateLlamaStackContainerss).mockRejectedValue(new Error('Creation failed'));

  render(StartLlamaStackContainer);

  const startBtn = await screen.findByTitle('Start Llama Stack container');
  await userEvent.click(startBtn);

  await vi.waitFor(() => {
    screen.getByText('Error: Creation failed');
  });
});

test('updates stack_containers from tasks', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'serverId', port: 50000, state: 'running' },
    playground: { containerId: 'pgId', port: 60000, state: 'running' },
  });
  const task = {
    labels: {
      containerId: 'serverId',
      port: '50000',
      state: 'running',
      playgroundId: 'pgId',
      playgroundPort: '60000',
      playgroundState: 'running',
    },
  } as unknown as Task;

  vi.mocked(tasks).tasks = writable([task]);
  render(StartLlamaStackContainer);

  await vi.waitFor(() => {
    const btn = screen.getByTitle('Open Llama Stack Server container');
    expect(btn).toBeEnabled();
  });
});

test('start button switches to open buttons when server and playground ready', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue({
    server: { containerId: 'serverId', port: 50000, state: 'running' },
    playground: { containerId: 'pgId', port: 60000, state: 'running' },
  });

  render(StartLlamaStackContainer);

  await vi.waitFor(() => {
    const serverBtn = screen.getByTitle('Open Llama Stack Server container');
    const playgroundBtn = screen.getByTitle('Open Llama Stack Playground container');
    expect(serverBtn).toBeEnabled();
    expect(playgroundBtn).toBeEnabled();
  });
});

test('selects first started container provider by default', async () => {
  render(StartLlamaStackContainer);

  await vi.waitFor(() => {
    expect(containerProviderConnection).toEqual(containerProviderConnection);
  });
});

test('start button shows inProgress state when tasks are loading', async () => {
  vi.mocked(llamaStackClient.getLlamaStackContainersInfo).mockResolvedValue(undefined);
  const loadingTask = { state: 'loading', labels: { trackingId: LLAMA_STACK_CONTAINER_TRACKINGID } } as unknown as Task;
  vi.mocked(tasks).tasks = writable([loadingTask]);
  render(StartLlamaStackContainer);

  await vi.waitFor(() => {
    const startBtn = screen.getByTitle('Start Llama Stack container');
    expect(startBtn).toBeInTheDocument();
  });
});
