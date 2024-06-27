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
import { Publisher } from '../utils/Publisher';
import { Disposable, type Webview } from '@podman-desktop/api';
import { Messages } from '@shared/Messages';
import type { InferenceType, RuntimeType } from '@shared/src/models/IInference';
import type { InferenceProvider } from '../workers/provider/InferenceProvider';

export class InferenceProviderRegistry extends Publisher<string[]> {
  #providers: Map<RuntimeType, InferenceProvider<unknown>[]>;

  constructor(webview: Webview) {
    super(webview, Messages.MSG_INFERENCE_PROVIDER_UPDATE, () => this.getAll().map(provider => provider.name));
    this.#providers = new Map();
  }

  register(provider: InferenceProvider<unknown>): Disposable {
    if (this.has(provider.runtime, provider.name)) throw new Error('provider already registered');

    const providers = this.#providers.get(provider.runtime) ?? [];
    this.#providers.set(provider.runtime, [...providers, provider]);

    this.notify();
    return Disposable.create(() => {
      this.unregister(provider.runtime, provider.name);
    });
  }

  unregister(runtime: RuntimeType, name: string): void {
    const providers = this.#providers.get(runtime) ?? [];
    if (providers.length === 0) return;

    this.#providers.set(
      runtime,
      providers.filter(provider => provider.name !== name),
    );
  }

  getAll(): InferenceProvider<unknown>[] {
    return Array.from(this.#providers.values()).flat();
  }

  getByType<T extends InferenceProvider<unknown>>(runtime: RuntimeType, type: InferenceType): T[] {
    return (this.#providers.get(runtime) ?? []).filter((provider): provider is T => provider.type === type);
  }

  has(runtime: RuntimeType, name: string): boolean {
    return (this.#providers.get(runtime) ?? []).some(provider => provider.name === name);
  }

  get<T extends InferenceProvider<unknown>>(runtime: RuntimeType, name: string): T {
    const provider = (this.#providers.get(runtime) ?? []).find(provider => provider.name === name);
    if (provider === undefined) throw new Error(`no provider with name ${name} was found.`);
    return provider as T;
  }
}
