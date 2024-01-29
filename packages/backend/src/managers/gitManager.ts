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

import simpleGit from 'simple-git';

export interface GitCloneInfo {
  repository: string;
  branch: string;
  sha: string;
  targetDirectory: string;
}

export class GitManager {
  async cloneRepository(gitCloneInfo: GitCloneInfo) {
    // clone repo
    await simpleGit().clone(gitCloneInfo.repository, gitCloneInfo.targetDirectory, ['-b', gitCloneInfo.branch]);
    // checkout to specific branch
    await simpleGit(gitCloneInfo.targetDirectory).checkout([gitCloneInfo.sha]);
  }
}
