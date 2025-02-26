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
import { expect, test, vi } from 'vitest';
import { Publisher } from './Publisher';
import type { RpcExtension } from '@shared/src/messages/MessageProxy';
import { MSG_TASKS_UPDATE } from '@shared/Messages';
import type { Task } from '@shared/src/models/ITask';

test('ensure publisher properly use getter', async () => {
  const rpcExtensionMock = { fire: vi.fn().mockResolvedValue(true) } as unknown as RpcExtension;
  const fakeTasks = ['dummyValue'];
  const getterMock = vi.fn().mockReturnValue(fakeTasks);
  const publisher = new Publisher<Task[]>(rpcExtensionMock, MSG_TASKS_UPDATE, getterMock);
  publisher.notify();

  await vi.waitFor(() => {
    expect(rpcExtensionMock.fire).toHaveBeenCalledWith(MSG_TASKS_UPDATE, fakeTasks);
  });
  expect(getterMock).toHaveBeenCalled();
});
