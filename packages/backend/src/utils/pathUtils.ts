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

import { readdir, stat, statfs } from 'node:fs/promises';
import { join, parse, dirname, normalize } from 'node:path';
import type { StatsFs } from 'node:fs';

export function getParentDirectory(filePath: string): string {
  // Normalize the path to handle different platform-specific separators
  const normalizedPath = normalize(filePath);

  // Get the directory name using path.dirname
  return dirname(normalizedPath);
}

/**
 * Recursively stats files to get size of a folder
 * @param dir
 *
 * source: https://stackoverflow.com/a/69418940
 */
export async function dirSize(dir: string): Promise<number> {
  const files = await readdir(dir, { withFileTypes: true });

  const paths = files.map(async file => {
    const path = join(dir, file.name);

    if (file.isDirectory()) return await dirSize(path);

    if (file.isFile()) {
      const { size } = await stat(path);

      return size;
    }

    return 0;
  });

  return (await Promise.all(paths)).flat(Infinity).reduce((i, size) => i + size, 0);
}

/**
 * Given a path E.g. C:/hello/world will return the StatsFs of the disk
 * @param path
 */
export async function getDiskSize(path: string): Promise<StatsFs> {
  return statfs(parse(path).root);
}
