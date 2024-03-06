import { type Disposable, type FileSystemWatcher, fs, EventEmitter, type Event } from '@podman-desktop/api';
import * as nodeFs from 'fs';
import { promises } from 'node:fs';

export class JsonWatcher<T> implements Disposable {
  #fileSystemWatcher: FileSystemWatcher | undefined;

  private readonly _onEvent = new EventEmitter<T>();
  readonly onContentUpdated: Event<T> = this._onEvent.event;

  constructor(private path: string, private defaultValue: T) {}

  init(): void {
    try {
      this.#fileSystemWatcher = fs.createFileSystemWatcher(this.path);
      // Setup listeners
      this.#fileSystemWatcher.onDidChange(this.onDidChange.bind(this));
      this.#fileSystemWatcher.onDidDelete(this.onDidDelete.bind(this));
      this.#fileSystemWatcher.onDidCreate(this.onDidCreate.bind(this));
    } catch (err: unknown) {
      console.error(`unable to watch file ${this.path}, changes wont be detected.`, err);
    }
    this.requestUpdate();
  }

  private onDidCreate(): void {
    this.requestUpdate();
  }

  private onDidDelete(): void {
    this.requestUpdate();
  }

  private onDidChange(): void {
    this.requestUpdate();
  }

  private requestUpdate(): void {
    this.updateContent().catch((err) => {
      console.error('Something went wrong in update content', err);
    });
  }

  private async updateContent(): Promise<void> {
    if(!nodeFs.existsSync(this.path)) {
      this._onEvent.fire(this.defaultValue);
      return;
    }

    try {
      const data = await promises.readFile(this.path, 'utf-8');
      this._onEvent.fire(JSON.parse(data));
    } catch (err: unknown) {
      console.error('Something went wrong JsonWatcher', err);
    }
  }

  dispose(): void {
    this.#fileSystemWatcher?.dispose();
  }
}
