import type { Readable } from 'svelte/store';
import { readable } from 'svelte/store';
import { MSG_NEW_CATALOG_STATE } from '@shared/Messages';
import { rpcBrowser, studioClient } from '/@/utils/client';
import type { Catalog } from '@shared/src/models/ICatalog';

const emptyCatalog = {
  categories: [],
  models: [],
  recipes: [],
};

export const catalog: Readable<Catalog> = readable<Catalog>(emptyCatalog, set => {
  const sub = rpcBrowser.subscribe(MSG_NEW_CATALOG_STATE, msg => {
    set(msg);
  });
  // Initialize the store manually
  studioClient.getCatalog().then(state => {
    set(state);
  });
  return () => {
    sub.unsubscribe();
  };
});
