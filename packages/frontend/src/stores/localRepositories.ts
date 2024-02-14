import type { Readable } from 'svelte/store';
import { readable } from 'svelte/store';
import { MSG_LOCAL_REPOSITORY_UPDATE, MSG_NEW_RECIPE_STATE } from '@shared/Messages';
import { rpcBrowser, studioClient } from '/@/utils/client';
import type { LocalRepository } from '@shared/src/models/ILocalRepository';

export const localRepositories: Readable<LocalRepository[]> = readable<LocalRepository[]>([], set => {
  const sub = rpcBrowser.subscribe(MSG_LOCAL_REPOSITORY_UPDATE, msg => {
    set(msg);
  });
  // Initialize the store manually
  studioClient.getLocalRepositories().then(state => {
    set(state);
  });
  return () => {
    sub.unsubscribe();
  };
});
