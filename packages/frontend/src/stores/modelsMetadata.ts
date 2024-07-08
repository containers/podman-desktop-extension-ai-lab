import { type Writable, writable } from 'svelte/store';

export const modelsMetadata: Writable<Record<string, Record<string, unknown>>> = writable({});
