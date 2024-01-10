import type { ModelInfo } from '@shared/models/IModelInfo';
import type { Readable } from 'svelte/store';
import { readable } from 'svelte/store';
import { studioClient } from '/@/utils/client';

export const localModels: Readable<ModelInfo[]> = readable<ModelInfo[]>([], (set) => {
    studioClient.getLocalModels().then(v => {
        set(v);
    })
});
