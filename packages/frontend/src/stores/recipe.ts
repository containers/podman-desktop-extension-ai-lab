import type { Readable } from 'svelte/store';
import { derived, readable } from 'svelte/store';
import { MSG_NEW_RECIPE_STATE } from '@shared/Messages';
import { rpcBrowser, studioClient } from '/@/utils/client';
import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';

export const recipes: Readable<Map<string, RecipeStatus>> = readable<Map<string, RecipeStatus>>(
  new Map<string, RecipeStatus>(),
  set => {
    const sub = rpcBrowser.subscribe(MSG_NEW_RECIPE_STATE, msg => {
      set(msg);
    });
    // Initialize the store manually
    studioClient.getPullingStatuses().then(state => {
      set(state);
    });
    return () => {
      sub.unsubscribe();
    };
  },
);

export const modelsPulling = derived(recipes, $recipes => {
  return Array.from($recipes.values())
    .flatMap(recipe => recipe.tasks)
    .filter(task => 'model-pulling' in (task.labels || {}));
});
