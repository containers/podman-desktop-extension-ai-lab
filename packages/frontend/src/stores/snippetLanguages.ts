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
import { MSG_SUPPORTED_LANGUAGES_UPDATE } from '@shared/Messages';
import { studioClient } from '/@/utils/client';
import { RPCReadable } from '/@/stores/rpcReadable';
import type { Language } from 'postman-code-generators';

export const snippetLanguages: Readable<Language[]> = RPCReadable<Language[]>(
  [],
  MSG_SUPPORTED_LANGUAGES_UPDATE,
  studioClient.getSnippetLanguages,
);
