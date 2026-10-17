/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

// Integration test against the REAL isomorphic-git (no mocks here), verifying that the
// symlink fallback actually intercepts the library's checkout. Windows EPERM is simulated
// by forcing the underlying fs.symlink to throw, so this runs anywhere (incl. macOS/Linux).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import git from 'isomorphic-git';
import { withSymlinkFallback } from './gitManager';

describe('withSymlinkFallback + real isomorphic-git', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ailab-git-symlink-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('checkout of a committed symlink falls back to a plain file when symlink is refused', async () => {
    // Build a repo that contains a committed symlink (real symlink is fine on this host).
    await git.init({ fs, dir, defaultBranch: 'main' });
    fs.writeFileSync(path.join(dir, 'target.txt'), 'hello');
    fs.symlinkSync('target.txt', path.join(dir, 'link.txt'));
    await git.add({ fs, dir, filepath: '.' });
    await git.commit({ fs, dir, message: 'add symlink', author: { name: 't', email: 't@example.com' } });

    // Wipe the working tree so checkout has to re-materialize both entries.
    fs.rmSync(path.join(dir, 'link.txt'));
    fs.rmSync(path.join(dir, 'target.txt'));

    // fs whose symlink always fails with EPERM (simulating a non-privileged Windows user),
    // everything else delegating to the real fs.
    const eperm = (): NodeJS.ErrnoException => Object.assign(new Error('EPERM'), { code: 'EPERM' });
    const epermFs = {
      ...fs,
      symlink: (_t: fs.PathLike, _p: fs.PathLike, cbOrType: unknown, cb?: unknown): void =>
        ((typeof cbOrType === 'function' ? cbOrType : cb) as (e: NodeJS.ErrnoException) => void)(eperm()),
      promises: {
        ...fs.promises,
        symlink: (): Promise<void> => Promise.reject(eperm()),
      },
    } as unknown as typeof fs;

    const wrapped = withSymlinkFallback(epermFs, 'win32');

    // The real library must route its symlink creation through our wrapper; otherwise this
    // throws (the failure we see on Windows today).
    await expect(git.checkout({ fs: wrapped, dir, ref: 'main', force: true })).resolves.toBeUndefined();

    // link.txt now exists as a plain file containing the link target, not a symlink.
    const linkPath = path.join(dir, 'link.txt');
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(linkPath, 'utf8')).toBe('target.txt');
  });
});
