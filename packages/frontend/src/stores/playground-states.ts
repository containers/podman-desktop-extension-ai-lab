import type { Readable } from 'svelte/store';
import { readable } from 'svelte/store';
import { MSG_PLAYGROUNDS_STATE_UPDATE } from '@shared/Messages';
import { rpcBrowser, studioClient } from '/@/utils/client';
import type { PlaygroundState } from '@shared/src/models/IPlaygroundState';

export const playgroundStates: Readable<PlaygroundState[]> = readable<PlaygroundState[]>([], set => {
  const sub = rpcBrowser.subscribe(MSG_PLAYGROUNDS_STATE_UPDATE, msg => {
    set(msg);
  });
  // Initialize the store manually
  studioClient.getPlaygroundsState().then(state => {
    set(state);
  });
  return () => {
    sub.unsubscribe();
  };
});
