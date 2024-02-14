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
import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import * as podmanDesktopApi from '@podman-desktop/api';
import { MSG_LOCAL_REPOSITORY_UPDATE } from '@shared/Messages';
import type { Webview } from '@podman-desktop/api';

/**
 * The LocalRepositoryRegistry is responsible for keeping track of the directories where recipe are cloned
 */
export class LocalRepositoryRegistry {
  // Map path => LocalRepository
  private repositories: Map<string, LocalRepository> = new Map();

  constructor(private webview: Webview) {}

  register(localRepository: LocalRepository): podmanDesktopApi.Disposable {
    this.repositories.set(localRepository.path, localRepository);
    this.notify();

    return podmanDesktopApi.Disposable.create(() => {
      this.unregister(localRepository.path);
    });
  }

  unregister(path: string): void {
    this.repositories.delete(path);
    this.notify();
  }

  getLocalRepositories(): LocalRepository[] {
    return Array.from(this.repositories.values());
  }

  private notify() {
    this.webview.postMessage({
      id: MSG_LOCAL_REPOSITORY_UPDATE,
      body: this.getLocalRepositories(),
    }).catch((err: unknown) => {
      console.error('Something went wrong while notifying local repositories update', err);
    });
  }
}
