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
import { expect, test, vi } from 'vitest';
import { Publisher } from './Publisher';
import type { Webview } from '@podman-desktop/api';

test('ensure publisher properly use getter', async () => {
  const postMessageMock = vi.fn().mockResolvedValue(undefined);
  const getterMock = vi.fn().mockReturnValue('dummyValue');
  const publisher = new Publisher<string>(
    {
      postMessage: postMessageMock,
    } as unknown as Webview,
    'dummyChannel',
    getterMock,
  );
  publisher.notify();

  await vi.waitFor(() => {
    expect(postMessageMock).toHaveBeenCalledWith({
      id: 'dummyChannel',
      body: 'dummyValue',
    });
  });
  expect(getterMock).toHaveBeenCalled();
});
