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
import { Publisher } from '../../utils/Publisher';
import type { MESSAGES } from '@shared/Messages';
import type { Disposable, Webview } from '@podman-desktop/api';
import { JsonWatcher } from '../../utils/JsonWatcher';

export class BaseCatalog<T extends { id: string }> extends Publisher<T[]> implements Disposable {
  #items: Map<string, T>;
  #disposables: Disposable[];

  constructor(
    webview: Webview,
    channel: MESSAGES,
    private catalog: string,
    private defaultItems: T[],
  ) {
    super(webview, channel, () => this.getAll());
    this.#items = new Map<string, T>();
    this.#disposables = [];
  }

  init(): void {
    // Creating a json watcher
    const jsonWatcher: JsonWatcher<T[]> = new JsonWatcher(
      this.catalog,
      this.defaultItems,
    );
    jsonWatcher.onContentUpdated(content => this.onCatalogUpdate(content));
    jsonWatcher.init();

    this.#disposables.push(jsonWatcher);
  }

  private onCatalogUpdate(items: T[]): void {
    this.#items = new Map(items.map(item => [item.id, item]));
    this.notify();
  }

  dispose(): void {
    this.#items.clear();
    this.#disposables.forEach(watcher => watcher.dispose());
  }

  get(id: string): T | undefined {
    return this.#items.get(id);
  }

  getAll(): T[] {
    return Array.from(this.#items.values());
  }
}
