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

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { rpcBrowser } from '../utils/client';
import type { Unsubscriber } from 'svelte/store';
import { modelsInfo } from './modelsInfo';
import { type RpcChannel, createRpcChannel, type Listener, clearRpcChannelList } from '@shared/messages/MessageProxy';
import { MSG_NEW_MODELS_STATE } from '@shared/Messages';

const mocks = vi.hoisted(() => {
  return {
    getModelsInfoMock: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../utils/client', async () => {
  const subscriber = new Map();
  const invokeMethod = (msgId: string, _: unknown[]): void => {
    const f = subscriber.get(msgId);
    f();
  };
  const subscribeMethod = (rpcChannel: RpcChannel<unknown>, f: Listener<unknown>): unknown => {
    subscriber.set(rpcChannel.name, f);
    return {
      unsubscribe: (): void => {
        subscriber.clear();
      },
    };
  };
  const getProxyMethod = (_: unknown): unknown => {
    return {
      send: invokeMethod,
    };
  };
  const rpcBrowser = {
    getProxy: getProxyMethod,
    invoke: invokeMethod,
    subscribe: subscribeMethod,
  };
  return {
    rpcBrowser,
    studioClient: {
      getModelsInfo: mocks.getModelsInfoMock,
    },
  };
});

let unsubscriber: Unsubscriber | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  clearRpcChannelList();
  unsubscriber = modelsInfo.subscribe(_ => {});
});

afterEach(() => {
  if (unsubscriber) {
    unsubscriber();
    unsubscriber = undefined;
  }
});

test('check getLocalModels is called at subscription', async () => {
  expect(mocks.getModelsInfoMock).toHaveBeenCalledOnce();
});

test('check getLocalModels is called twice if event is fired (one at init, one for the event)', async () => {
  type MyModel = {
    send: (message: string) => Promise<void>;
  };
  const channel = createRpcChannel<MyModel>(MSG_NEW_MODELS_STATE.name);
  const proxy = rpcBrowser.getProxy<MyModel>(channel);
  await proxy.send(MSG_NEW_MODELS_STATE.name);
  // wait for the timeout in the debouncer
  await new Promise(resolve => setTimeout(resolve, 600));
  expect(mocks.getModelsInfoMock).toHaveBeenCalledTimes(2);
});
