import type { Disposable, Webview } from '@podman-desktop/api';
import { getLanguageList, convert, type Language } from 'postman-code-generators';
import { Request } from 'postman-collection';
import { Publisher } from '../utils/Publisher';
import { MSG_SUPPORTED_LANGUAGES_UPDATE } from '@shared/Messages';

export class SnippetManager extends Publisher<Language[]> implements Disposable {
  constructor(webview: Webview) {
    super(webview, MSG_SUPPORTED_LANGUAGES_UPDATE, () => this.getLanguageList());
  }

  getLanguageList(): Language[] {
    return getLanguageList();
  }

  generate(url: string, language: string, variant: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = new Request(url);
      convert(language, variant, request, {}, (error: unknown, snippet: string) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(snippet);
      });
    });
  }

  init() {
    // Notify the publisher
    this.notify();
  }

  dispose(): void {}
}
