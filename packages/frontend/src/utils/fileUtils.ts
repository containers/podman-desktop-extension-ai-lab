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
import type { LocalModelImportInfo } from '@shared/src/models/ILocalModelInfo';

/**
 * This would only work in Electron as the `path` property is
 * not available is browser.
 */
export function getFilesFromDropEvent(event: DragEvent): LocalModelImportInfo[] {
  if (!event.dataTransfer) return [];
  const output: LocalModelImportInfo[] = [];

  let files: File[];
  if (event.dataTransfer.files.length) {
    files = Array.from(event.dataTransfer.files);
  } else {
    files = Array.from(event.dataTransfer.items)
      .map(item => item.getAsFile())
      .filter((item): item is File => !!item);
  }
  for (const file of files) {
    if (file && 'path' in file && typeof file.path === 'string') output.push({ path: file.path, name: file.name });
  }
  return output;
}
