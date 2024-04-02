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
import { screen, render } from '@testing-library/svelte';
import SettingsNavItem from '/@/lib/SettingsNavItem.svelte';
import type { TinroRouteMeta } from 'tinro';
import { faBookOpen } from '@fortawesome/free-solid-svg-icons';

test('should be selected', () => {
  render(SettingsNavItem, {
    title: 'DummyTitle',
    href: '/dummy/path',
    meta: {
      url: '/dummy/path',
    } as unknown as TinroRouteMeta,
  });
  const container = screen.getByLabelText('DummyTitle');
  expect(container).toBeInTheDocument();
  expect(container.firstElementChild).toHaveClass('border-purple-500');
});

test('should not be selected', () => {
  render(SettingsNavItem, {
    title: 'DummyTitle',
    href: '/dummy/path',
    meta: {
      url: '/other/path',
    } as unknown as TinroRouteMeta,
  });
  const container = screen.getByLabelText('DummyTitle');
  expect(container).toBeInTheDocument();
  expect(container.firstElementChild).toHaveClass('text-gray-400');
});

test('icon should be visible', () => {
  render(SettingsNavItem, {
    title: 'DummyTitle',
    href: '/dummy/path',
    meta: {
      url: '/dummy/path',
    } as unknown as TinroRouteMeta,
    icon: faBookOpen,
  });
  const svg = screen.getByRole('img', { hidden: true });
  expect(svg).toBeInTheDocument();
});
