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
import { expect, test, beforeEach, describe } from 'vitest';
import { fireEvent, render, within } from '@testing-library/svelte';
import ToolCallMessage from '/@/lib/conversation/ToolCallMessage.svelte';

describe('ToolCallMessage component', () => {
  let container: HTMLElement;
  describe('with result', () => {
    beforeEach(() => {
      container = render(ToolCallMessage, {
        message: {
          id: '1337',
          timestamp: Date.now() - 500,
          completed: Date.now(),
          role: 'assistant',
          content: {
            type: 'tool-call',
            toolCallId: '1-1',
            toolName: 'weather',
            args: { location: 'Don Benito' },
            result: {
              content: [{ type: 'text', text: 'The weather in Don Benito is sunny with a temperature of 25°C.' }],
            },
          },
        },
      }).container;
    });
    test('Has role', () => {
      const role = within(container).getByTestId('tool-call-role');
      expect(role?.textContent).toBe('Assistant');
    });
    test('Has summary', () => {
      const summary = within(container).getByTestId('tool-call-summary');
      expect(summary?.textContent).toMatch(/Used tool: weather/);
    });
    test('Details are hidden by default', () => {
      const result = within(container).getByTestId('tool-call-details');
      expect(Array.from(result?.classList)).contains('h-0');
    });
    test('Has arguments', () => {
      const args = within(container).getByTestId('tool-call-arguments');
      expect(args?.textContent).toBe('{\n' + '  "location": "Don Benito"\n' + '}');
    });
    test('Has result', () => {
      const result = within(container).getByTestId('tool-call-result');
      expect(result?.textContent).toBe(
        '{\n' +
          '  "content": [\n' +
          '    {\n' +
          '      "type": "text",\n' +
          '      "text": "The weather in Don Benito is sunny with a temperature of 25°C."\n' +
          '    }\n' +
          '  ]\n' +
          '}',
      );
    });
    test('Has toggle button', () => {
      const toggleButton = within(container).getByTestId('tool-call-show-details');
      expect(toggleButton).toBeDefined();
    });
    test('Clicking toggle button shows details', async () => {
      const toggleButton = within(container).getByTestId('tool-call-show-details');
      await fireEvent.click(toggleButton);
      const result = within(container).getByTestId('tool-call-details');
      expect(Array.from(result?.classList)).not.contains('h-0');
      expect(Array.from(result?.classList)).contains('h-fit');
    });
    test('Has elapsed time', () => {
      const elapsedTime = within(container).getByText('0.5 s');
      expect(elapsedTime.ariaLabel).toBe('elapsed');
      expect(elapsedTime).toBeDefined();
    });
  });
  describe('without result', () => {
    beforeEach(() => {
      container = render(ToolCallMessage, {
        message: {
          id: '1337',
          timestamp: Date.now() - 500,
          role: 'assistant',
          content: {
            type: 'tool-call',
            toolCallId: '1-1',
            toolName: 'weather',
            args: { location: 'Don Benito' },
          },
        },
      }).container;
    });
    test('Has role', () => {
      const role = within(container).getByTestId('tool-call-role');
      expect(role?.textContent).toBe('Assistant');
    });
    test('Has summary', () => {
      const summary = within(container).getByTestId('tool-call-summary');
      expect(summary?.textContent).toMatch(/Used tool: weather/);
    });
    test('Details are hidden by default', () => {
      const result = within(container).getByTestId('tool-call-details');
      expect(Array.from(result?.classList)).contains('h-0');
    });
    test('Has arguments', () => {
      const args = within(container).getByTestId('tool-call-arguments');
      expect(args?.textContent).toBe('{\n' + '  "location": "Don Benito"\n' + '}');
    });
    test('Does not have result', () => {
      const result = within(container).queryByTestId('tool-call-result');
      expect(result).toBeNull();
    });
  });
});
