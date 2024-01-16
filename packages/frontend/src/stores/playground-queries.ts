import type { Readable } from 'svelte/store';
import { readable } from 'svelte/store';
import type { QueryState } from '@shared/src/models/IPlaygroundQueryState';
import { MSG_NEW_PLAYGROUND_QUERIES_STATE } from '@shared/Messages';
import { rpcBrowser, studioClient } from '/@/utils/client';

export const playgroundQueries: Readable<QueryState[]> = readable<QueryState[]>([], set => {
  const sub = rpcBrowser.subscribe(MSG_NEW_PLAYGROUND_QUERIES_STATE, msg => {
    set(msg);
  });
  // Initialize the store manually
  studioClient.getPlaygroundStates().then(state => {
    set(state);
  });
  return () => {
    sub.unsubscribe();
  };
});
