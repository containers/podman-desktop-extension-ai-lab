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

import {
  type RegisterContainerConnectionEvent,
  provider,
  type UpdateContainerConnectionEvent,
  containerEngine,
  type PodInfo,
} from '@podman-desktop/api';

export type startupHandle = () => void;
export type machineStartHandle = () => void;
export type machineStopHandle = () => void;
export type podStartHandle = (pod: PodInfo) => void;
export type podStopHandle = (pod: PodInfo) => void;
export type podRemoveHandle = (podId: string) => void;

export class PodmanConnection {
  #firstFound = false;
  #toExecuteAtStartup: startupHandle[] = [];
  #toExecuteAtMachineStop: machineStopHandle[] = [];
  #toExecuteAtMachineStart: machineStartHandle[] = [];
  #toExecuteAtPodStart: podStartHandle[] = [];
  #toExecuteAtPodStop: podStopHandle[] = [];
  #toExecuteAtPodRemove: podRemoveHandle[] = [];

  init(): void {
    this.listenRegistration();
    this.listenMachine();
    this.watchPods();
  }

  listenRegistration() {
    // In case the extension has not yet registered, we listen for new registrations
    // and retain the first started podman provider
    const disposable = provider.onDidRegisterContainerConnection((e: RegisterContainerConnectionEvent) => {
      if (e.connection.type !== 'podman' || e.connection.status() !== 'started') {
        return;
      }
      if (this.#firstFound) {
        return;
      }
      this.#firstFound = true;
      for (const f of this.#toExecuteAtStartup) {
        f();
      }
      this.#toExecuteAtStartup = [];
      disposable.dispose();
    });

    // In case at least one extension has already registered, we get one started podman provider
    const engines = provider
      .getContainerConnections()
      .filter(connection => connection.connection.type === 'podman')
      .filter(connection => connection.connection.status() === 'started');
    if (engines.length > 0) {
      disposable.dispose();
      this.#firstFound = true;
    }
  }

  // startupSubscribe registers f to be executed when a podman container provider
  // registers, or immediately if already registered
  startupSubscribe(f: startupHandle): void {
    if (this.#firstFound) {
      f();
    } else {
      this.#toExecuteAtStartup.push(f);
    }
  }

  listenMachine() {
    provider.onDidUpdateContainerConnection((e: UpdateContainerConnectionEvent) => {
      if (e.connection.type !== 'podman') {
        return;
      }
      if (e.status === 'stopped') {
        for (const f of this.#toExecuteAtMachineStop) {
          f();
        }
      } else if (e.status === 'started') {
        for (const f of this.#toExecuteAtMachineStart) {
          f();
        }
      }
    });
  }

  onMachineStart(f: machineStartHandle) {
    this.#toExecuteAtMachineStart.push(f);
  }

  onMachineStop(f: machineStopHandle) {
    this.#toExecuteAtMachineStop.push(f);
  }

  watchPods() {
    containerEngine.onEvent(event => {
      if (event.Type !== 'pod') {
        return;
      }
      switch (event.status) {
        case 'remove':
          console.log('remove pod id', event.id);
          for (const f of this.#toExecuteAtPodRemove) {
            f(event.id);
          }
          break;
        case 'start':
          console.log('start pod id', event.id);
          containerEngine
            .listPods()
            .then((pods: PodInfo[]) => {
              const pod = pods.find((p: PodInfo) => p.Id === event.id);
              if (!pod) {
                return;
              }
              for (const f of this.#toExecuteAtPodStart) {
                f(pod);
              }
            })
            .catch((err: unknown) => {
              console.error(err);
            });
          break;
        case 'stop':
          console.log('stop pod id', event.id);
          containerEngine
            .listPods()
            .then((pods: PodInfo[]) => {
              const pod = pods.find((p: PodInfo) => p.Id === event.id);
              if (!pod) {
                return;
              }
              for (const f of this.#toExecuteAtPodStop) {
                f(pod);
              }
            })
            .catch((err: unknown) => {
              console.error(err);
            });
          break;
      }
      console.log('==> event', event);
    });
  }

  onPodStart(f: podStartHandle) {
    this.#toExecuteAtPodStart.push(f);
  }

  onPodStop(f: podStopHandle) {
    this.#toExecuteAtPodStop.push(f);
  }

  onPodRemove(f: podRemoveHandle) {
    this.#toExecuteAtPodRemove.push(f);
  }
}
