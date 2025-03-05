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
import type { ExtensionConfiguration } from '@shared/src/models/IExtensionConfiguration';
import { studioClient } from '/@/utils/client';
import { gte } from 'semver';

const USE_CASES = ['natural-language-processing', 'audio', 'computer-vision'];
const LANGUAGES = ['java', 'javascript', 'python'];
export const FRAMEWORKS = ['langchain', 'langchain4j', 'quarkus', 'react', 'streamlit', 'vectordb'];
export const TOOLS = ['none', 'llama-cpp', 'whisper-cpp'];

// Defaulting to Podman Desktop min version we need to run
let version: string = '1.8.0';
let configuration: ExtensionConfiguration;
let isDark = true;

async function setupProps(): Promise<void> {
  configuration = await studioClient.getExtensionConfiguration();
  version = (await studioClient.getPDVersion()).toString().replace(/-next/g, '');

  if (configuration.appearance === 'dark') isDark = true;
  else if (configuration.appearance === 'light') isDark = false;
  else if (configuration.appearance === 'system') {
    const app = document.getElementById('app');
    if (!app) throw new Error('cannot found app element');
    const style = window.getComputedStyle(app);
    const color = style.getPropertyValue('--pd-terminal-background').trim();
    isDark = color === '#000';
  }
}

setupProps().catch((e: unknown) => {
  throw new Error(`Got an error when setting up props: ${e}`);
});

function getColor(pdColor: string, darkColor: string, lightColor: string): string {
  if (gte(version, '1.17.0')) {
    return pdColor;
  } else {
    if (isDark) return darkColor;
    return lightColor;
  }
}

function createBGColorMap(): Map<string, string> {
  return new Map<string, string>([
    ...USE_CASES.map(
      useCase =>
        [useCase, getColor('bg-[var(--pd-label-primary-bg)]', 'bg-purple-700', 'bg-purple-300')] as [string, string],
    ),
    ...LANGUAGES.map(
      useCase =>
        [useCase, getColor('bg-[var(--pd-label-secondary-bg)]', 'bg-sky-900', 'bg-sky-200')] as [string, string],
    ),
    ...FRAMEWORKS.map(
      useCase =>
        [useCase, getColor('bg-[var(--pd-label-tertiary-bg)]', 'bg-green-900', 'bg-green-200')] as [string, string],
    ),
    ...TOOLS.map(
      useCase =>
        [useCase, getColor('bg-[var(--pd-label-quaternary-bg)]', 'bg-amber-800', 'bg-amber-100')] as [string, string],
    ),
  ]);
}

function createTextColorMap(): Map<string, string> {
  return new Map<string, string>([
    ...USE_CASES.map(
      useCase =>
        [useCase, getColor('text-[var(--pd-label-primary-text)]', 'text-purple-300', 'text-purple-700')] as [
          string,
          string,
        ],
    ),
    ...LANGUAGES.map(
      useCase =>
        [useCase, getColor('text-[var(--pd-label-secondary-text)]', 'text-sky-200', 'text-sky-900')] as [
          string,
          string,
        ],
    ),
    ...FRAMEWORKS.map(
      useCase =>
        [useCase, getColor('text-[var(--pd-label-tertiary-text)]', 'text-green-200', 'text-green-900')] as [
          string,
          string,
        ],
    ),
    ...TOOLS.map(
      useCase =>
        [useCase, getColor('text-[var(--pd-label-quaternary-text)]', 'text-amber-400', 'text-amber-900')] as [
          string,
          string,
        ],
    ),
  ]);
}

export function getBGColor(tag: string): string {
  const color =
    createBGColorMap().get(tag) ?? getColor('bg-[var(--pd-label-primary-bg)]', 'bg-purple-700', 'bg-purple-300');
  return color;
}

export function getTextColor(tag: string): string {
  const color =
    createTextColorMap().get(tag) ??
    getColor('text-[var(--pd-label-primary-text)]', 'text-purple-300', 'text-purple-700');
  return color;
}
