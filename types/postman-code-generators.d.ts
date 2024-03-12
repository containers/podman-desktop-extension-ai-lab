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
declare module 'postman-code-generators' {
  import type { Request } from 'postman-collection';

  export function getLanguageList(): Language[];

  export interface Language {
    key: string;
    label: string;
    syntax_mode: string;
    variants: LanguageVariant[],
  }

  export interface LanguageVariant {
    key: string;
  }

  export function getOptions(language: string, variant: string, callback: (error: unknown, options: Option[]) => void): void;

  export interface Option {
    name: string;
    id: string;
    type: string;
    default: string | number | boolean;
    description: string;
  }

  export function convert(language: string, variant: string, request: Request, options: Record<string, string | number | boolean>, callback: (error: unknown, snippet: string | undefined) => void): void;
}
