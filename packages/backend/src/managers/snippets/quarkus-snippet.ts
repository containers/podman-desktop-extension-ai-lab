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
import type { RequestOptions } from '@shared/src/models/RequestOptions';
import mustache from 'mustache';
import template from '../../templates/quarkus-langchain4j.mustache?raw';
import xmljs from 'xml-js';

const SUFFIX_LENGTH = '/chat/completions'.length;

const METADATA_URL =
  'https://repo1.maven.org/maven2/io/quarkiverse/langchain4j/quarkus-langchain4j-core/maven-metadata.xml';

let quarkusLangchain4jVersion: string;

async function getQuarkusLangchain4jVersion(): Promise<string> {
  if (quarkusLangchain4jVersion) {
    return quarkusLangchain4jVersion;
  }
  const response = await fetch(METADATA_URL, { redirect: 'follow' });
  const content = JSON.parse(xmljs.xml2json(await response.text(), { compact: true }));
  return (quarkusLangchain4jVersion = content.metadata.versioning.release._text);
}
export async function quarkusLangchain4Jgenerator(requestOptions: RequestOptions): Promise<string> {
  return mustache.render(template, {
    baseUrl: requestOptions.url.substring(0, requestOptions.url.length - SUFFIX_LENGTH),
    version: await getQuarkusLangchain4jVersion(),
  });
}
