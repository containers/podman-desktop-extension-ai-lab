/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import { writable, type Subscriber, type Unsubscriber, type Readable } from 'svelte/store';
import { rpcBrowser } from '../utils/client';
import type { RpcChannel, Subscriber as SharedSubscriber } from '@shared/messages/MessageProxy';

export function RPCReadable<T>(
  value: T,
  // The event channel used to subscribe to a webview postMessage event
  subscriptionEventChannel: RpcChannel<T>,
  // The initialization function that will be called to update the store at creation.
  // For example, you can pass in a custom function such as "getPullingStatuses".
  updater: () => Promise<T>,
): Readable<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  let timeoutThrottle: NodeJS.Timeout | undefined;

  const debouncedUpdater = debounce(updater);
  const origWritable = writable(value);

  function subscribe(this: void, run: Subscriber<T>, invalidate?: () => void): Unsubscriber {
    const rcpSubscribes: SharedSubscriber[] = [];

    const rcpSubscribe = rpcBrowser.subscribe<T>(subscriptionEventChannel, (_: unknown) => {
      debouncedUpdater()
        .then(v => origWritable.set(v))
        .catch((e: unknown) => console.error('failed at updating store', String(e)));
    });
    rcpSubscribes.push(rcpSubscribe);

    updater()
      .then(v => origWritable.set(v))
      .catch((e: unknown) => console.error('failed at init store', String(e)));

    const unsubscribe = origWritable.subscribe(run, invalidate);
    return () => {
      rcpSubscribes.forEach(r => r.unsubscribe());
      unsubscribe();
    };
  }

  function debounce(func: () => Promise<T>): () => Promise<T> {
    return () =>
      new Promise<T>(resolve => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        // throttle timeout, ask after 5s to update anyway to have at least UI being refreshed every 5s if there is a lot of events
        // because debounce will defer all the events until the end so it's not so nice from UI side.
        if (!timeoutThrottle) {
          // eslint-disable-next-line sonarjs/no-nested-functions
          timeoutThrottle = setTimeout(() => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = undefined;
            }
            resolve(func());
          }, 5000);
        }

        // eslint-disable-next-line sonarjs/no-nested-functions
        timeoutId = setTimeout(() => {
          if (timeoutThrottle) {
            clearTimeout(timeoutThrottle);
            timeoutThrottle = undefined;
          }
          resolve(func());
        }, 500);
      });
  }

  return {
    subscribe,
  };
}
