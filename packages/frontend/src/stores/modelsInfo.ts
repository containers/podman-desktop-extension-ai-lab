import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { Readable } from 'svelte/store';
import { readable } from 'svelte/store';
import { rpcBrowser, studioClient } from '/@/utils/client';
import { MSG_NEW_MODELS_STATE } from '@shared/Messages';

export const modelsInfo: Readable<ModelInfo[]> = readable<ModelInfo[]>([], set => {
  const sub = rpcBrowser.subscribe(MSG_NEW_MODELS_STATE, msg => {
    set(msg);
  });
  // Initialize the store manually
  studioClient.getModelsInfo().then(v => {
    set(v);
  });
  return () => {
    sub.unsubscribe();
  };
});
