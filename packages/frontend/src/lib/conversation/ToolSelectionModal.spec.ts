/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import { expect, test, beforeEach, describe, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, within } from '@testing-library/svelte';
import type { McpServer } from '@shared/models/McpSettings';
import ToolSelectionModal from '/@/lib/conversation/ToolSelectionModal.svelte';

let container: HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('with servers', () => {
  beforeEach(() => {
    container = render(ToolSelectionModal, {
      mcpServers: [{ name: 'server-1' } as unknown as McpServer, { name: 'server-2' } as unknown as McpServer],
    }).container;
  });
  describe('closed', () => {
    test('has button', () => {
      const button = within(container).getByTitle('MCP Servers');
      expect(button).toBeVisible();
      expect(button).toHaveTextContent('MCP Servers');
    });
    test('does not have modal', () => {
      const modal = within(container).queryByTestId('tool-selection-modal-tool-container');
      expect(modal).toBeNull();
    });
  });
  describe('open', () => {
    let button: HTMLElement;
    let modal: HTMLElement;
    beforeEach(async () => {
      button = within(container).getByTitle('MCP Servers');
      await fireEvent.click(button);
      modal = within(container).getByTestId('tool-selection-modal-tool-container');
    });
    test('has modal', () => {
      expect(modal).toBeVisible();
    });
    test('contains defined server entries', () => {
      const toolEntries = within(modal).getAllByTestId('tool-selection-modal-tool-item');
      expect(toolEntries).toHaveLength(2);
    });
    test.each(['server-1', 'server-2'])('has %s entry', name => {
      const serverEntry = within(modal).getByText(name);
      expect(serverEntry).toBeVisible();
    });
  });
});
