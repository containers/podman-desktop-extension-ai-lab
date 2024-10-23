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
import { type Disposable, type FileSystemWatcher, fs, EventEmitter, type Event } from '@podman-desktop/api';
import { promises, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export class JsonWatcher<T> implements Disposable {
  #fileSystemWatcher: FileSystemWatcher | undefined;

  private readonly _onEvent = new EventEmitter<T>();
  readonly onContentUpdated: Event<T> = this._onEvent.event;

  constructor(
    private path: string,
    private defaultValue: T,
  ) {}

  init(): void {
    try {
      // we create the parent directory of the watched content
      // if the parent directory does not exists, the watcher is not initialized properly
      mkdirSync(path.dirname(this.path), { recursive: true });

      // create file system watcher
      this.#fileSystemWatcher = fs.createFileSystemWatcher(this.path);
      // Setup listeners
      this.#fileSystemWatcher.onDidChange(this.onDidChange.bind(this));
      this.#fileSystemWatcher.onDidDelete(this.onDidDelete.bind(this));
      this.#fileSystemWatcher.onDidCreate(this.onDidCreate.bind(this));
    } catch (err: unknown) {
      console.error(`unable to watch file ${this.path}, changes won't be detected.`, err);
    }
    this.requestUpdate();
  }

  private onDidCreate(): void {
    this.requestUpdate();
  }

  private onDidDelete(): void {
    this.requestUpdate();
  }

  private onDidChange(): void {
    this.requestUpdate();
  }

  private requestUpdate(): void {
    this.updateContent().catch((err: unknown) => {
      console.error('Something went wrong in update content', err);
    });
  }

  private async updateContent(): Promise<void> {
    if (!existsSync(this.path)) {
      this._onEvent.fire(this.defaultValue);
      return;
    }

    try {
      const data = await promises.readFile(this.path, 'utf-8');
      this._onEvent.fire(JSON.parse(data));
    } catch (err: unknown) {
      console.error('Something went wrong JsonWatcher', err);
    }
  }

  dispose(): void {
    this.#fileSystemWatcher?.dispose();
  }
}
