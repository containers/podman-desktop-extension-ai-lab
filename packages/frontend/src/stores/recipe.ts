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
import { MSG_NEW_RECIPE_STATE, MSG_TASKS_UPDATE } from '@shared/Messages';
import { rpcBrowser, studioClient } from '/@/utils/client';
import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';

export const recipes: Readable<Map<string, RecipeStatus>> = readable<Map<string, RecipeStatus>>(
  new Map<string, RecipeStatus>(),
  set => {
    const sub = rpcBrowser.subscribe(MSG_NEW_RECIPE_STATE, msg => {
      set(msg);
    });

    const pull = () => {
      studioClient.getPullingStatuses().then(state => {
        set(state);
      });
    };

    // Initialize the store manually
    pull();

    // when the tasks are updated we pull the recipe updates
    const tasks = rpcBrowser.subscribe(MSG_TASKS_UPDATE, _ => {
      pull();
    });

    return () => {
      sub.unsubscribe();
      tasks.unsubscribe();
    };
  },
);
