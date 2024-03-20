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

import { expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { studioClient } from '/@/utils/client';
import ConversationColumnAction from '/@/lib/table/playground/ConversationColumnAction.svelte';

vi.mock('../../../utils/client', async () => ({
  studioClient: {
    deleteConversation: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(studioClient.deleteConversation).mockResolvedValue(undefined);
});

test('should call deleteConversation when click delete', async () => {
  render(ConversationColumnAction, {
    object: {
      id: 'dummyConversationId',
      name: 'dummyName',
      modelId: 'dummyModelId',
    },
  });

  const startBtn = screen.getByTitle('Delete conversation');
  await fireEvent.click(startBtn);
  expect(studioClient.deleteConversation).toHaveBeenCalledWith('dummyConversationId');
});
