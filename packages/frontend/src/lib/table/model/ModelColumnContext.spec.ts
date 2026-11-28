/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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
import type { ModelInfo } from '@shared/models/IModelInfo';
import ModelColumnContext from './ModelColumnContext.svelte';

const model: ModelInfo = { id: 'my-model', name: 'My model', description: '' };

test('Expect the maximum context size as is, with a tooltip', () => {
  render(ModelColumnContext, { object: { ...model, maxCtxSize: 131072 } });

  const text = screen.getByText('131072');
  expect(text).toBeInTheDocument();
  expect(text).toHaveAttribute('title', 'Maximum context size (tokens)');
  expect(text.parentElement).toHaveClass('text-[var(--pd-table-body-text)]');
});

test('Expect nothing when the model has no maximum context size', () => {
  const { container } = render(ModelColumnContext, { object: model });

  expect(container).toHaveTextContent('');
  expect(screen.queryByTitle(/Maximum context size/)).not.toBeInTheDocument();
});
