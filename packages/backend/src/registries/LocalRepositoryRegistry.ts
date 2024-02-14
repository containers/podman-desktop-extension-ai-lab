import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import * as podmanDesktopApi from '@podman-desktop/api';
import { MSG_LOCAL_REPOSITORY_UPDATE } from '@shared/Messages';
import type { Webview } from '@podman-desktop/api';

/**
 * The LocalRepositoryRegistry is responsible for keeping track of the directories where recipe are cloned
 */
export class LocalRepositoryRegistry {
  // Map path => LocalRepository
  private repositories: Map<string, LocalRepository> = new Map();

  constructor(private webview: Webview) {}

  register(localRepository: LocalRepository): podmanDesktopApi.Disposable {
    this.repositories.set(localRepository.path, localRepository);
    this.notify();

    return podmanDesktopApi.Disposable.create(() => {
      this.unregister(localRepository.path);
    });
  }

  unregister(path: string): void {
    this.repositories.delete(path);
    this.notify();
  }

  getLocalRepositories(): LocalRepository[] {
    return Object.values(this.repositories);
  }

  private notify() {
    this.webview.postMessage({
      id: MSG_LOCAL_REPOSITORY_UPDATE,
      body: this.getLocalRepositories(),
    }).catch((err: unknown) => {
      console.error('Something went wrong while notifying local repositories update', err);
    });
  }
}
