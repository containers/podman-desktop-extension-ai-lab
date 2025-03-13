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
import { Publisher } from '../utils/Publisher';
import { Disposable, type Webview } from '@podman-desktop/api';
import { Messages } from '@shared/Messages';
import type { ModelRegistry } from '../models/ModelRegistry';

export class ModelRegistryRegistry extends Publisher<string[]> {
  #providers: Map<string, ModelRegistry>;
  constructor(webview: Webview) {
    super(webview, Messages.MSG_MODEL_REGISTRY_UPDATE, () => this.getAll().map(provider => provider.name));
    this.#providers = new Map();
  }

  register(provider: ModelRegistry): Disposable {
    this.#providers.set(provider.name, provider);

    this.notify();
    return Disposable.create(() => {
      this.unregister(provider);
    });
  }

  unregister(provider: ModelRegistry): void {
    this.#providers.delete(provider.name);
    this.notify();
  }

  getAll(): ModelRegistry[] {
    return Array.from(this.#providers.values());
  }

  findModelRegistry(url: string): ModelRegistry | undefined {
    return Array.from(this.#providers.values()).find(modelRegistry => modelRegistry.accept(url));
  }
}
