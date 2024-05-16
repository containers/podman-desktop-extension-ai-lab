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
import crypto from 'node:crypto';
import * as fs from 'node:fs';
import { promises } from 'node:stream';

export async function hasValidSha(filePath: string, expectedSha: string): Promise<boolean> {
  const checkSum = crypto.createHash('sha256');
  const input = fs.createReadStream(filePath);
  await promises.pipeline(input, checkSum);

  const actualSha = checkSum.digest('hex');
  return actualSha === expectedSha;
}
