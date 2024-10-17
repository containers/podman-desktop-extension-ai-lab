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
import { test, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import Navigation from './Navigation.svelte';
import type { TinroRouteMeta } from 'tinro';

vi.mock('../utils/client', async () => ({
  studioClient: {
    getExtensionConfiguration: vi.fn().mockResolvedValue({}),
  },
  rpcBrowser: {
    subscribe: (): unknown => {
      return {
        unsubscribe: (): void => {},
      };
    },
  },
}));

test('Expect panel to have correct styling', async () => {
  render(Navigation, { meta: { url: 'test' } as TinroRouteMeta });

  const panel = screen.getByLabelText('PreferencesNavigation');
  expect(panel).toBeInTheDocument();
  expect(panel).toHaveClass('bg-[var(--pd-secondary-nav-bg)]');
  expect(panel).toHaveClass('border-[var(--pd-global-nav-bg-border)]');
  expect(panel).toHaveClass('border-r-[1px]');
});
