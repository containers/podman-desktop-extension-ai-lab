import simpleGit, { type SimpleGit } from 'simple-git';

export class GitManager {
  private readonly simpleGit: SimpleGit;
  constructor() {
    this.simpleGit = simpleGit();
  }

  async cloneRepository(repository: string, targetDirectory: string) {
    return this.simpleGit.clone(repository, targetDirectory);
  }
}
