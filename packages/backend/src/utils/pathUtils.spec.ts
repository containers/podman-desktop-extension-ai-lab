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

import { vi, describe, test, expect, beforeEach } from 'vitest';
import { getMappedPathInPodmanMachine } from './pathUtils';
import * as podmanDesktopApi from '@podman-desktop/api';

vi.mock('@podman-desktop/api', async () => {
  return {
    env: {
      isWindows: false,
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getMappedPathInPodmanMachine', () => {
  test('return original path if env is not Windows', async () => {
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    const result = getMappedPathInPodmanMachine('path');
    expect(result).equals('path');
  });
  test('return original path if env is Windows', async () => {
    vi.mocked(podmanDesktopApi.env).isWindows = true;
    const result = getMappedPathInPodmanMachine('C:\\dir1\\dir2\\file');
    expect(result).equals('/mnt/c/dir1/dir2/file');
  });
});
