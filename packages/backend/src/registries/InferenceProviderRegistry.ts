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
import { Publisher } from '../utils/Publisher';
import type { InferenceProvider } from '../workers/provider/InferenceProvider';
import { Disposable } from '@podman-desktop/api';
import { MSG_INFERENCE_PROVIDER_UPDATE } from '@shared/Messages';
import type { RpcExtension } from '@shared/messages/MessageProxy';
import type { InferenceType } from '@shared/models/IInference';

export class InferenceProviderRegistry extends Publisher<string[]> {
  #providers: Map<string, InferenceProvider>;
  constructor(rpcExtension: RpcExtension) {
    super(rpcExtension, MSG_INFERENCE_PROVIDER_UPDATE, () => this.getAll().map(provider => provider.name));
    this.#providers = new Map();
  }

  register(provider: InferenceProvider): Disposable {
    this.#providers.set(provider.name, provider);

    this.notify();
    return Disposable.create(() => {
      this.unregister(provider.name);
    });
  }

  unregister(name: string): void {
    this.#providers.delete(name);
  }

  getAll(): InferenceProvider[] {
    return Array.from(this.#providers.values());
  }

  getByType(type: InferenceType): InferenceProvider[] {
    return Array.from(this.#providers.values()).filter(provider => provider.type === type);
  }

  get(name: string): InferenceProvider {
    const provider = this.#providers.get(name);
    if (provider === undefined) throw new Error(`no provider with name ${name} was found.`);
    return provider;
  }
}
