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

import '@testing-library/jest-dom/vitest';
import { expect, test } from 'vitest';
import ContentDetailsLayoutTest from './ContentDetailsLayoutTest.svelte';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

test('should open/close details panel when clicking on toggle button', async () => {
  render(ContentDetailsLayoutTest);

  const panelOpenDetails = screen.getByLabelText('toggle a label');
  expect(panelOpenDetails).toHaveClass('hidden');
  const panelAppDetails = screen.getByLabelText('a label panel');
  expect(panelAppDetails).toHaveClass('block');

  const btnShowPanel = screen.getByRole('button', { name: 'show a label' });
  const btnHidePanel = screen.getByRole('button', { name: 'hide a label' });

  await userEvent.click(btnHidePanel);

  expect(panelAppDetails).toHaveClass('hidden');
  expect(panelOpenDetails).toHaveClass('block');

  await userEvent.click(btnShowPanel);

  expect(panelAppDetails).toHaveClass('block');
  expect(panelOpenDetails).toHaveClass('hidden');
});
