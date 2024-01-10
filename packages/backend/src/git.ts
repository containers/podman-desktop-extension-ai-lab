import simpleGit, { type SimpleGit } from "simple-git";


export class Git {
    private readonly simpleGit: SimpleGit
    constructor() {
        this.simpleGit = simpleGit();
    }

    async downloadRepo(repoPath: string) {
        await this.simpleGit.clone(repoPath, 'C:\\Users\\baldr\\Work\\github.com\\containers\\hackaton\\locallm');
    }
}