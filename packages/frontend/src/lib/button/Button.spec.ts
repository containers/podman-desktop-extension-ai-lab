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
import Button from '/@/lib/button/Button.svelte';

test('Button inProgress must have a spinner', async () => {
  // render the component
  render(Button, { inProgress: true });

  const svg = screen.getByRole('img');
  expect(svg).toBeDefined();
});

test('Button no progress no icon do not have spinner', async () => {
  // render the component
  render(Button, { inProgress: false });

  const svg = screen.queryByRole('img');
  expect(svg).toBeNull();
});
