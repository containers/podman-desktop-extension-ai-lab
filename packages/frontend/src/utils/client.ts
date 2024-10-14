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

import { StudioAPI } from '@shared/src/StudioAPI';
import { RpcBrowser } from '@shared/src/messages/MessageProxy';
import type { RouterState } from '/@/models/IRouterState';
import { InstructlabAPI } from '@shared/src/InstructlabAPI';

const podmanDesktopApi = acquirePodmanDesktopApi();
export const rpcBrowser: RpcBrowser = new RpcBrowser(window, podmanDesktopApi);

export const studioClient: StudioAPI = rpcBrowser.getProxy<StudioAPI>(StudioAPI);
export const instructlabClient: InstructlabAPI = rpcBrowser.getProxy<InstructlabAPI>(InstructlabAPI);

export const saveRouterState = (state: RouterState): void => {
  podmanDesktopApi.setState(state);
};

const isRouterState = (value: unknown): value is RouterState => {
  return typeof value === 'object' && !!value && 'url' in value;
};

export async function getRouterState(): Promise<RouterState> {
  const route: string | undefined = await studioClient.readRoute();
  if (route) {
    return {
      url: route,
    };
  }

  const state = podmanDesktopApi.getState();
  if (isRouterState(state)) return state;
  return { url: '/' };
}

Object.defineProperty(window, 'studioClient', {
  value: studioClient,
});
