import simpleGit from 'simple-git';
import type { GitCloneInfo } from '../models/GitCloneInfo';

export async function cloneRepository(gitCloneInfo: GitCloneInfo): Promise<void> {
  // clone repo
  await simpleGit().clone(gitCloneInfo.repository, gitCloneInfo.targetDirectory);
  // checkout to specific branch/commit if specified
  if (gitCloneInfo.ref) {
    await simpleGit(gitCloneInfo.targetDirectory).checkout([gitCloneInfo.ref]);
  }
}
