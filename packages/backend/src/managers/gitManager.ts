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

import simpleGit, { type PullResult, type RemoteWithRefs, type StatusResult } from 'simple-git';

export interface GitCloneInfo {
  repository: string;
  ref?: string;
  targetDirectory: string;
}

export class GitManager {
  async cloneRepository(gitCloneInfo: GitCloneInfo) {
    // clone repo
    await simpleGit().clone(gitCloneInfo.repository, gitCloneInfo.targetDirectory);
    // checkout to specific branch/commit if specified
    if (gitCloneInfo.ref) {
      await simpleGit(gitCloneInfo.targetDirectory).checkout([gitCloneInfo.ref]);
    }
  }

  async getRepositoryRemotes(directory: string): Promise<RemoteWithRefs[]> {
    return simpleGit(directory).getRemotes(true);
  }

  async getRepositoryStatus(directory: string): Promise<StatusResult> {
    return simpleGit(directory).status();
  }

  async isRepositoryUpToDate(
    directory: string,
    origin: string,
    ref?: string,
  ): Promise<{ ok?: boolean; error?: string }> {
    const remotes: RemoteWithRefs[] = await this.getRepositoryRemotes(directory);

    if (!remotes.some(remote => remote.refs.fetch === origin)) {
      return {
        error: `The local repository does not have remote ${origin} configured. Remotes: ${remotes
          .map(remote => `${remote.name} ${remote.refs.fetch} (fetch)`)
          .join(',')}`,
      };
    }

    const status: StatusResult = await this.getRepositoryStatus(directory);

    if (status.detached) {
      return { error: 'The local repository is detached.' };
    }

    if (status.modified.length > 0) {
      return { error: 'The local repository has modified files.' };
    }

    if (status.ahead !== 0) {
      return {
        error: `The local repository has ${status.ahead} commit(s) ahead.`,
      };
    }

    // Ensure the branch tracked is the one we want
    if (ref !== undefined && status.tracking !== ref) {
      return {
        error: `The local repository is not tracking the right branch. (tracking ${status.tracking} when expected ${ref})`,
      };
    }

    // Ensure working with a clean branch
    if (!status.isClean()) {
      return { error: 'The local repository is not clean.' };
    }

    // If we are not in HEAD
    if (status.behind !== 0) {
      const pullResult: PullResult = await simpleGit(directory).pull();
      console.debug(`local git repository updated. ${pullResult.summary.changes} changes applied`);
      return { ok: true };
    }
  }
}
