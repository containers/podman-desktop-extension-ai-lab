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

import { beforeEach, expect, test, vi } from 'vitest';
import { RpcBrowser } from '@shared/src/messages/MessageProxy';
import { RPCReadable } from './rpcReadable';
import { studioClient, rpcBrowser } from '../utils/client';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

const mocks = vi.hoisted(() => {
  return {
    getLocalModelsMock: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../utils/client', async () => {
  const window = {
    addEventListener: (_: string, _f: (message: unknown) => void) => {},
  } as unknown as Window;

  const api = {
    postMessage: (message: unknown) => {
      if (message && typeof message === 'object' && 'channel' in message) {
        const f = rpcBrowser.subscribers.get(message.channel as string);
        f?.('');
      }
    },
  } as unknown as PodmanDesktopApi;

  const rpcBrowser = new RpcBrowser(window, api);

  return {
    rpcBrowser: rpcBrowser,
    studioClient: {
      getLocalModels: mocks.getLocalModelsMock,
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('check updater is called once at subscription', async () => {
  const rpcWritable = RPCReadable<string[]>([], [], () => {
    studioClient.getLocalModels();
    return Promise.resolve(['']);
  });
  rpcWritable.subscribe(_ => {});
  expect(mocks.getLocalModelsMock).toHaveBeenCalledOnce();
});

test('check updater is called twice if there is one event fired', async () => {
  const rpcWritable = RPCReadable<string[]>([], ['event'], () => {
    studioClient.getLocalModels();
    return Promise.resolve(['']);
  });
  rpcWritable.subscribe(_ => {});
  rpcBrowser.invoke('event');
  // wait for the timeout in the debouncer
  await new Promise(resolve => setTimeout(resolve, 600));
  expect(mocks.getLocalModelsMock).toHaveBeenCalledTimes(2);
});

test('check updater is called only twice because of the debouncer if there is more than one event in a row', async () => {
  const rpcWritable = RPCReadable<ModelInfo[]>([], ['event2'], () => {
    return studioClient.getLocalModels();
  });
  rpcWritable.subscribe(_ => {});
  rpcBrowser.invoke('event2');
  rpcBrowser.invoke('event2');
  rpcBrowser.invoke('event2');
  rpcBrowser.invoke('event2');
  // wait for the timeout in the debouncer
  await new Promise(resolve => setTimeout(resolve, 600));
  expect(mocks.getLocalModelsMock).toHaveBeenCalledTimes(2);
});
