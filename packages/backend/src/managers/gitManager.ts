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
import { window } from '@podman-desktop/api';
import { statSync, existsSync, mkdirSync, rmSync } from 'node:fs';

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

  async getCurrentCommit(directory: string): Promise<string> {
    return simpleGit(directory).revparse('HEAD');
  }

  async pull(directory: string): Promise<void> {
    const pullResult: PullResult = await simpleGit(directory).pull();
    console.debug(`local git repository updated. ${pullResult.summary.changes} changes applied`);
  }

  async isGitInstalled(): Promise<boolean> {
    try {
      const version = await simpleGit().version();
      return version.installed;
    } catch (err: unknown) {
      console.error(`Something went wrong while trying to access git: ${String(err)}`);
      return false;
    }
  }

  async processCheckout(gitCloneInfo: GitCloneInfo): Promise<void> {
    // Check for existing cloned repository
    if (existsSync(gitCloneInfo.targetDirectory) && statSync(gitCloneInfo.targetDirectory).isDirectory()) {
      const result = await this.isRepositoryUpToDate(
        gitCloneInfo.targetDirectory,
        gitCloneInfo.repository,
        gitCloneInfo.ref,
      );

      if (result.ok) {
        return;
      }

      const error = `The repository "${gitCloneInfo.repository}" appears to have already been cloned and does not match the expected configuration: ${result.error}`;

      // Ask user
      const selected = await window.showWarningMessage(
        `${error} By continuing, the AI application may not run as expected. `,
        'Cancel',
        'Continue',
        result.updatable ? 'Update' : 'Reset',
      );

      switch (selected) {
        case undefined:
        case 'Cancel':
          throw new Error('Cancelled');
        case 'Continue':
          return;
        case 'Update':
          await this.pull(gitCloneInfo.targetDirectory);
          return;
        case 'Reset':
          rmSync(gitCloneInfo.targetDirectory, { recursive: true });
          break;
      }
    }

    // Create folder
    mkdirSync(gitCloneInfo.targetDirectory, { recursive: true });

    // Clone the repository
    console.log(`Cloning repository ${gitCloneInfo.repository} in ${gitCloneInfo.targetDirectory}.`);
    await this.cloneRepository(gitCloneInfo);
  }

  async isRepositoryUpToDate(
    directory: string,
    origin: string,
    ref?: string,
  ): Promise<{ ok?: boolean; updatable?: boolean; error?: string }> {
    // fetch updates
    await simpleGit(directory).fetch();

    const remotes: RemoteWithRefs[] = await this.getRepositoryRemotes(directory);

    if (!remotes.some(remote => remote.refs.fetch === origin)) {
      return {
        error: `The local repository does not have remote ${origin} configured. Remotes: ${remotes
          .map(remote => `${remote.name} ${remote.refs.fetch} (fetch)`)
          .join(',')}`,
      };
    }

    const status: StatusResult = await this.getRepositoryStatus(directory);

    let error: string | undefined;

    if (!remotes.some(remote => remote.refs.fetch === origin)) {
      error = `The local repository does not have remote ${origin} configured. Remotes: ${remotes
        .map(remote => `${remote.name} ${remote.refs.fetch} (fetch)`)
        .join(',')}`;
    } else if (status.detached) {
      // when the repository is detached
      if (ref === undefined) {
        error = 'The local repository is detached.';
      } else {
        const commit = await this.getCurrentCommit(directory);
        if (!commit.startsWith(ref)) error = `The local repository is detached. HEAD is ${commit} expected ${ref}.`;
      }
    } else if (status.ahead !== 0) {
      error = `The local repository has ${status.ahead} commit(s) ahead.`;
    } else if (ref !== undefined && status.tracking !== ref) {
      error = `The local repository is not tracking the right branch. (tracking ${status.tracking} when expected ${ref})`;
    } else if (!status.isClean()) {
      error = 'The local repository is not clean.';
    } else if (status.behind !== 0) {
      return { ok: true, updatable: true };
    }

    if (error) {
      return { error };
    }

    if (status.modified.length > 0) {
      error = 'The local repository has modified files.';
    } else if (status.created.length > 0) {
      error = 'The local repository has created files.';
    } else if (status.deleted.length > 0) {
      error = 'The local repository has deleted files.';
    }

    if (error) {
      return { error };
    }

    return { ok: true }; // If none of the error conditions are met
  }
}
