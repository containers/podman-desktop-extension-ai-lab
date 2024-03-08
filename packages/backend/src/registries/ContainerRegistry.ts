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
import * as podmanDesktopApi from '@podman-desktop/api';

export type Subscriber = {
  id: number;
  callback: (status: string) => void;
};

export interface ContainerStart {
  id: string;
}

export class ContainerRegistry {
  private count: number = 0;
  private subscribers: Map<string, Subscriber[]> = new Map();

  private readonly _onStartContainerEvent = new podmanDesktopApi.EventEmitter<ContainerStart>();
  readonly onStartContainerEvent: podmanDesktopApi.Event<ContainerStart> = this._onStartContainerEvent.event;

  init(): podmanDesktopApi.Disposable {
    return podmanDesktopApi.containerEngine.onEvent(event => {
      if (event.status === 'start') {
        this._onStartContainerEvent.fire({
          id: event.id,
        });
      }

      if (this.subscribers.has(event.id)) {
        this.subscribers.get(event.id).forEach(subscriber => subscriber.callback(event.status));

        // If the event type is remove, we dispose all subscribers for the specific containers
        if (event.status === 'remove') {
          this.subscribers.delete(event.id);
        }
      }
    });
  }

  subscribe(containerId: string, callback: (status: string) => void): podmanDesktopApi.Disposable {
    const existing: Subscriber[] = this.subscribers.has(containerId) ? this.subscribers.get(containerId) : [];
    const subscriberId = ++this.count;
    this.subscribers.set(containerId, [
      {
        id: subscriberId,
        callback: callback,
      },
      ...existing,
    ]);

    return podmanDesktopApi.Disposable.create(() => {
      if (!this.subscribers.has(containerId)) return;

      this.subscribers.set(
        containerId,
        this.subscribers.get(containerId).filter(subscriber => subscriber.id !== subscriberId),
      );
    });
  }
}
