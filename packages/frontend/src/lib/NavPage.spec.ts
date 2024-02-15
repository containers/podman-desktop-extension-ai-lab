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
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import NavPage from '/@/lib/NavPage.svelte';

test('NavPage should have linear progress', async () => {
  // render the component
  render(NavPage, { loading: true, title: 'dummy' });

  const content = await screen.findByLabelText('content');
  expect(content).toBeDefined();
  expect(content.firstChild?.nodeName).toBe('PROGRESS');
});

test('NavPage should not have linear progress', async () => {
  // render the component
  render(NavPage, { title: 'dummy' });

  const content = await screen.findByLabelText('content');
  expect(content).toBeDefined();
  expect(content.firstChild).toBeNull(); // no slot content provided
});

test('NavPage should have custom background', async () => {
  // render the component
  render(NavPage, { title: 'dummy', contentBackground: 'bg-white' });

  const content = await screen.findByLabelText('content');
  expect(content).toBeDefined();
  expect(content).toHaveClass('bg-white');
});
