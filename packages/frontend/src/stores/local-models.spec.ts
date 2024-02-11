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
import { localModels } from './local-models';
import { MSG_NEW_LOCAL_MODELS_STATE } from '@shared/Messages';
import { rpcBrowser } from '../utils/client';
import type { Unsubscriber } from 'svelte/store';

const mocks = vi.hoisted(() => {
  return {
    getLocalModelsMock: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../utils/client', async () => {
  const subscriber = new Map();
  const rpcBrowser = {
    invoke: (msgId: string, _: unknown[]) => {
      const f = subscriber.get(msgId);
      f();
    },
    subscribe: (msgId: string, f: (msg: any) => void) => {
      subscriber.set(msgId, f);
      return {
        unsubscribe: () => {
          subscriber.clear();
        },
      };
    },
  };
  return {
    rpcBrowser,
    studioClient: {
      getLocalModels: mocks.getLocalModelsMock,
    },
  };
});

let unsubscriber: Unsubscriber | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  unsubscriber = localModels.subscribe(_ => {});
});

afterEach(() => {
  if (unsubscriber) {
    unsubscriber();
    unsubscriber = undefined;
  }
});

test('check getLocalModels is called at subscription', async () => {
  expect(mocks.getLocalModelsMock).toHaveBeenCalledOnce();
});

test('check getLocalModels is called twice if event is fired (one at init, one for the event)', async () => {
  rpcBrowser.invoke(MSG_NEW_LOCAL_MODELS_STATE);
  // wait for the timeout in the debouncer
  await new Promise(resolve => setTimeout(resolve, 600));
  expect(mocks.getLocalModelsMock).toHaveBeenCalledTimes(2);
});
