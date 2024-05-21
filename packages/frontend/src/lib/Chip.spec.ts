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
import { render, screen } from '@testing-library/svelte';
import Chip from './Chip.svelte';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

test('print Chip with custom text and default background', async () => {
  render(Chip, { icon: faTrash, content: 'custom-text' });

  const chipContent = screen.getByText('custom-text');
  expect(chipContent).toBeInTheDocument();
  expect(chipContent).toHaveClass('bg-charcoal-600');
});

test('print Chip with custom text and custom background', async () => {
  render(Chip, { icon: faTrash, content: 'custom-text', background: 'bg-charcoal-100' });

  const chipContent = screen.getByText('custom-text');
  expect(chipContent).toBeInTheDocument();
  expect(chipContent).toHaveClass('bg-charcoal-100');
  expect(chipContent).not.toHaveClass('bg-charcoal-600');
});
