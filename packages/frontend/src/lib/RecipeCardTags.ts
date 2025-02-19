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

const USE_CASES = ['natural-language-processing', 'audio', 'computer-vision'];
const LANGUAGES = ['java', 'javascript', 'python'];
export const FRAMEWORKS = ['langchain', 'langchain4j', 'quarkus', 'react', 'streamlit', 'vectordb'];
export const TOOLS = ['none', 'llama-cpp', 'whisper-cpp'];

export const TAG_BG_COLOR = new Map<string, string>([
  ...USE_CASES.map(useCase => [useCase, isDarkMode() ? 'bg-purple-700' : 'bg-purple-300']),
  ...LANGUAGES.map(useCase => [useCase, isDarkMode() ? 'bg-sky-900' : 'bg-sky-200']),
  ...FRAMEWORKS.map(useCase => [useCase, isDarkMode() ? 'bg-green-900' : 'bg-green-200']),
  ...TOOLS.map(useCase => [useCase, isDarkMode() ? 'bg-amber-800' : 'bg-amber-100']),
]);

export const TAG_TEXT_COLOR = new Map<string, string>([
  ...USE_CASES.map(useCase => [useCase, isDarkMode() ? 'text-purple-300' : 'text-purple-700']),
  ...LANGUAGES.map(useCase => [useCase, isDarkMode() ? 'text-sky-200' : 'text-sky-900']),
  ...FRAMEWORKS.map(useCase => [useCase, isDarkMode() ? 'text-green-200' : 'text-green-900']),
  ...TOOLS.map(useCase => [useCase, isDarkMode() ? 'text-amber-400' : 'text-amber-900']),
]);

export function isDarkMode(): boolean {
  const app = document.getElementById('app');
  if (!app) throw new Error('cannot found app element');
  const style = window.getComputedStyle(app);

  const color = style.getPropertyValue('--pd-terminal-background').trim();
  return color === '#000';
}
