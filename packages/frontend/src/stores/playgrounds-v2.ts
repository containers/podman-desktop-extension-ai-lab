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

import type { Readable } from 'svelte/store';
import { readable } from 'svelte/store';
import { Messages } from '@shared/Messages';
import { rpcBrowser, studioClient } from '/@/utils/client';
import type { PlaygroundV2 } from '@shared/src/models/IPlaygroundV2';

export const playgrounds: Readable<PlaygroundV2[]> = readable<PlaygroundV2[]>([], set => {
  const sub = rpcBrowser.subscribe(Messages.MSG_PLAYGROUNDS_V2_UPDATE, msg => {
    set(msg);
  });
  // Initialize the store manually
  studioClient.getPlaygroundsV2().then(state => {
    set(state);
  });
  return () => {
    sub.unsubscribe();
  };
});
