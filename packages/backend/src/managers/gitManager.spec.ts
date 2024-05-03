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
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { GitManager } from './gitManager';
import { statSync, existsSync, mkdirSync, type Stats, rmSync } from 'node:fs';
import type fs from 'node:fs';
import { window } from '@podman-desktop/api';

const mocks = vi.hoisted(() => {
  return {
    cloneMock: vi.fn(),
    statusMatrixMock: vi.fn(),
    fetchMock: vi.fn(),
    currentBranchMock: vi.fn(),
    logMock: vi.fn(),
    resolveRefMock: vi.fn(),
    getConfigMock: vi.fn(),
  };
});

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

vi.mock('isomorphic-git', () => {
  return {
    default: {
      clone: mocks.cloneMock,
      currentBranch: mocks.currentBranchMock,
      log: mocks.logMock,
      resolveRef: mocks.resolveRefMock,
      fetch: mocks.fetchMock,
      getConfig: mocks.getConfigMock,
      statusMatrix: mocks.statusMatrixMock,
    },
  };
});

vi.mock('@podman-desktop/api', async () => {
  return {
    window: {
      showWarningMessage: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolveRefMock.mockResolvedValue('dummyCommit');
});

describe('cloneRepository', () => {
  const gitmanager = new GitManager();
  test('clone and checkout if ref is specified', async () => {
    await gitmanager.cloneRepository({
      repository: 'repo',
      targetDirectory: 'target',
      ref: '000',
    });
    expect(mocks.cloneMock).toBeCalledWith({
      fs: expect.anything(),
      http: expect.anything(),
      url: 'repo',
      dir: 'target',
      ref: '000',
      singleBranch: true,
      depth: 1,
    });
  });
  test('clone and checkout if ref is NOT specified', async () => {
    await gitmanager.cloneRepository({
      repository: 'repo',
      targetDirectory: 'target',
    });
    expect(mocks.cloneMock).toBeCalledWith({
      fs: expect.anything(),
      http: expect.anything(),
      url: 'repo',
      dir: 'target',
      ref: undefined,
      singleBranch: true,
      depth: 1,
    });
  });
});

describe('processCheckout', () => {
  test('first install no existing folder', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await new GitManager().processCheckout({
      repository: 'repo',
      targetDirectory: 'target',
      ref: '000',
    });

    expect(existsSync).toHaveBeenCalledWith('target');
    expect(mkdirSync).toHaveBeenCalledWith('target', { recursive: true });
    expect(mocks.cloneMock).toBeCalledWith({
      fs: expect.anything(),
      http: expect.anything(),
      url: 'repo',
      dir: 'target',
      ref: '000',
      singleBranch: true,
      depth: 1,
    });
  });

  test('existing folder valid', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'isRepositoryUpToDate').mockResolvedValue({ ok: true });

    await gitmanager.processCheckout({
      repository: 'repo',
      targetDirectory: 'target',
      ref: '000',
    });

    expect(gitmanager.isRepositoryUpToDate).toHaveBeenCalled();
    expect(existsSync).toHaveBeenCalledWith('target');
    expect(statSync).toHaveBeenCalledWith('target');

    expect(mkdirSync).not.toHaveBeenCalled();
    expect(mocks.cloneMock).not.toHaveBeenCalled();
  });

  test('existing folder detached and user cancel', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(window.showWarningMessage).mockResolvedValue('Cancel');
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'isRepositoryUpToDate').mockResolvedValue({ ok: false, updatable: false });

    await expect(
      gitmanager.processCheckout({
        repository: 'repo',
        targetDirectory: 'target',
        ref: '000',
      }),
    ).rejects.toThrowError('Cancelled');
  });

  test('existing folder not-updatable and user continue', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(window.showWarningMessage).mockResolvedValue('Continue');
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'isRepositoryUpToDate').mockResolvedValue({ ok: false, updatable: false });

    await gitmanager.processCheckout({
      repository: 'repo',
      targetDirectory: 'target',
      ref: '000',
    });

    expect(rmSync).not.toHaveBeenCalled();
    expect(mkdirSync).not.toHaveBeenCalled();
    expect(mocks.cloneMock).not.toHaveBeenCalled();
  });

  test('existing folder not-updatable and user reset', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(window.showWarningMessage).mockResolvedValue('Reset');
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'isRepositoryUpToDate').mockResolvedValue({ ok: false, updatable: false });

    await gitmanager.processCheckout({
      repository: 'repo',
      targetDirectory: 'target',
      ref: '000',
    });

    expect(window.showWarningMessage).toHaveBeenCalledWith(expect.anything(), 'Cancel', 'Continue', 'Reset');
    expect(rmSync).toHaveBeenCalledWith('target', { recursive: true });
  });

  test('existing folder updatable and user update', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(window.showWarningMessage).mockResolvedValue('Update');
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'isRepositoryUpToDate').mockResolvedValue({ ok: false, updatable: true });
    vi.spyOn(gitmanager, 'pull').mockResolvedValue(undefined);

    await gitmanager.processCheckout({
      repository: 'repo',
      targetDirectory: 'target',
      ref: '000',
    });

    expect(window.showWarningMessage).toHaveBeenCalledWith(expect.anything(), 'Cancel', 'Continue', 'Update');
    expect(rmSync).not.toHaveBeenCalled();
    expect(gitmanager.pull).toHaveBeenCalled();
  });
});

describe('isRepositoryUpToDate', () => {
  test('no remote defined', async () => {
    const gitmanager = new GitManager();
    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'other-repo',
      },
    ]);
    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', undefined);
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe(
      'The local repository does not have remote repo configured. Remotes: origin other-repo (fetch)',
    );
  });

  test('detached invalid without ref', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    mocks.currentBranchMock.mockResolvedValue(undefined);

    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', undefined);
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository is detached.');
  });

  test('detached invalid with invalid ref', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getTagCommitId').mockResolvedValue(undefined); // ref is not a tag
    mocks.currentBranchMock.mockResolvedValue(undefined);

    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'invalidRef');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository is detached. HEAD is dummyCommit expected invalidRef.');
  });

  test('detached invalid with expected ref', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    mocks.statusMatrixMock.mockResolvedValue([['a', 1, 1, 1]]);
    mocks.currentBranchMock.mockResolvedValue(undefined);

    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'dummyCommit');
    expect(result.ok).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  test('detached with expected ref and modified files', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    mocks.statusMatrixMock.mockResolvedValue([
      ['a', 1, 1, 1],
      ['a_file', 1, 2, 1],
    ]);

    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'dummyCommit');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository has modified files.');
  });

  test('detached with expected ref and deleted files', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    mocks.statusMatrixMock.mockResolvedValue([
      ['a', 1, 1, 1],
      ['a_file', 1, 0, 1],
    ]);

    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'dummyCommit');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository has deleted files.');
  });

  test('detached with expected ref and created files', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    mocks.statusMatrixMock.mockResolvedValue([
      ['a', 1, 1, 1],
      ['a_file', 0, 2, 2],
    ]);

    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'dummyCommit');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository has created files.');
  });

  test('detached with expected ref and repository is not clean', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
    } as unknown as Stats);

    const gitmanager = new GitManager();

    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
      modified: [],
      created: [],
      deleted: [],
      clean: false,
    });

    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'dummyCommit');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository is not clean.');
  });

  test('using main branch and no local change', async () => {
    const gitmanager = new GitManager();
    mocks.currentBranchMock.mockResolvedValue('main');
    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getTrackingBranch').mockResolvedValue('origin/main');
    vi.spyOn(gitmanager, 'getBehindAhead').mockResolvedValue({ behind: 0, ahead: 0 });
    vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
      modified: [],
      created: [],
      deleted: [],
      clean: true,
    });
    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'main');
    expect(result.ok).toBeTruthy();
  });

  test('using main branch and tracking wrong branch', async () => {
    const gitmanager = new GitManager();
    mocks.currentBranchMock.mockResolvedValue('main');
    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getTrackingBranch').mockResolvedValue('origin/other-branch');
    vi.spyOn(gitmanager, 'getBehindAhead').mockResolvedValue({ behind: 0, ahead: 0 });
    vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
      modified: [],
      created: [],
      deleted: [],
      clean: true,
    });
    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'main');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe(
      'The local repository is not tracking the right branch. (tracking origin/other-branch when expected main)',
    );
  });

  test('using main branch and ahead', async () => {
    const gitmanager = new GitManager();
    mocks.currentBranchMock.mockResolvedValue('main');
    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getTrackingBranch').mockResolvedValue('origin/main');
    vi.spyOn(gitmanager, 'getBehindAhead').mockResolvedValue({ behind: 1, ahead: 2 });
    vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
      modified: [],
      created: [],
      deleted: [],
      clean: true,
    });
    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'main');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository has 2 commit(s) ahead.');
  });

  test('using main branch and behind', async () => {
    const gitmanager = new GitManager();
    mocks.currentBranchMock.mockResolvedValue('main');
    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getTrackingBranch').mockResolvedValue('origin/main');
    vi.spyOn(gitmanager, 'getBehindAhead').mockResolvedValue({ behind: 1, ahead: 0 });
    vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
      modified: [],
      created: [],
      deleted: [],
      clean: true,
    });
    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'main');
    expect(result.ok).toBeTruthy();
    expect(result.updatable).toBeTruthy();
  });

  test('using main branch and modified files', async () => {
    const gitmanager = new GitManager();
    mocks.currentBranchMock.mockResolvedValue('main');
    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getTrackingBranch').mockResolvedValue('origin/main');
    vi.spyOn(gitmanager, 'getBehindAhead').mockResolvedValue({ behind: 0, ahead: 0 });
    vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
      modified: ['a_modified_file.txt'],
      created: [],
      deleted: [],
      clean: true,
    });
    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'main');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository has modified files.');
  });

  test('using main branch and deleted files', async () => {
    const gitmanager = new GitManager();
    mocks.currentBranchMock.mockResolvedValue('main');
    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getTrackingBranch').mockResolvedValue('origin/main');
    vi.spyOn(gitmanager, 'getBehindAhead').mockResolvedValue({ behind: 0, ahead: 0 });
    vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
      modified: [],
      created: [],
      deleted: ['a_deleted_file.txt'],
      clean: true,
    });
    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'main');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository has deleted files.');
  });

  test('using main branch and created files', async () => {
    const gitmanager = new GitManager();
    mocks.currentBranchMock.mockResolvedValue('main');
    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getTrackingBranch').mockResolvedValue('origin/main');
    vi.spyOn(gitmanager, 'getBehindAhead').mockResolvedValue({ behind: 0, ahead: 0 });
    vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
      modified: [],
      created: ['a_created_file.txt'],
      deleted: [],
      clean: true,
    });
    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'main');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository has created files.');
  });

  test('using main branch and repository is not clean', async () => {
    const gitmanager = new GitManager();
    mocks.currentBranchMock.mockResolvedValue('main');
    vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
      {
        remote: 'origin',
        url: 'repo',
      },
    ]);
    vi.spyOn(gitmanager, 'getTrackingBranch').mockResolvedValue('origin/main');
    vi.spyOn(gitmanager, 'getBehindAhead').mockResolvedValue({ behind: 0, ahead: 0 });
    vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
      modified: [],
      created: [],
      deleted: [],
      clean: false,
    });
    const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'main');
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('The local repository is not clean.');
  });
});

test('using tag and no local change', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(statSync).mockReturnValue({
    isDirectory: () => true,
  } as unknown as Stats);

  const gitmanager = new GitManager();

  vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
    {
      remote: 'origin',
      url: 'repo',
    },
  ]);
  vi.spyOn(gitmanager, 'getTagCommitId').mockResolvedValue('dummyCommit'); // ref is a tag and points to commit
  vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
    modified: [],
    created: [],
    deleted: [],
    clean: true,
  });
  mocks.currentBranchMock.mockResolvedValue(undefined);

  const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'v1.0.0');
  expect(result.ok).toBeTruthy();
});

test('using wrong tag', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(statSync).mockReturnValue({
    isDirectory: () => true,
  } as unknown as Stats);

  const gitmanager = new GitManager();

  vi.spyOn(gitmanager, 'getRepositoryRemotes').mockResolvedValue([
    {
      remote: 'origin',
      url: 'repo',
    },
  ]);
  vi.spyOn(gitmanager, 'getTagCommitId').mockResolvedValue('otherCommit'); // ref is a tag and points to commit
  vi.spyOn(gitmanager, 'getRepositoryStatus').mockResolvedValue({
    modified: [],
    created: [],
    deleted: [],
    clean: true,
  });
  mocks.currentBranchMock.mockResolvedValue(undefined);

  const result = await gitmanager.isRepositoryUpToDate('target', 'repo', 'v1.0.0');
  expect(result.ok).toBeFalsy();
  expect(result.error).toBe('The local repository is detached. HEAD is dummyCommit expected otherCommit.');
});

test('getBehindAhead', async () => {
  const gitmanager = new GitManager();

  mocks.logMock.mockImplementation(async ({ ref }: { ref: string }) => {
    return new Promise(resolve => {
      if (ref === 'main') {
        resolve([
          {
            oid: 1,
          },
          {
            oid: 6,
          },
          {
            oid: 2,
          },
          {
            oid: 3,
          },
        ]);
      } else if (ref === 'origin/main') {
        resolve([
          {
            oid: 1,
          },
          {
            oid: 4,
          },
          {
            oid: 2,
          },
          {
            oid: 5,
          },
          {
            oid: 3,
          },
        ]);
      } else {
        resolve([]);
      }
    });
  });
  vi.spyOn(gitmanager, 'getTrackingBranch').mockResolvedValue('origin/main');
  const { behind, ahead } = await gitmanager.getBehindAhead('path/to/repo', 'main');
  expect(behind).toEqual(2);
  expect(ahead).toEqual(1);
});

test('getTrackingBranch', async () => {
  const gitmanager = new GitManager();
  mocks.getConfigMock.mockImplementation(async ({ path }: { path: string }) => {
    if (path === 'branch.my-branch.remote') {
      return 'origin';
    } else if (path === 'branch.my-branch.merge') {
      return 'refs/heads/my-remote-branch';
    }
  });
  const result = await gitmanager.getTrackingBranch('path/to/repository', 'my-branch');
  expect(result).toEqual('origin/my-remote-branch');
});
