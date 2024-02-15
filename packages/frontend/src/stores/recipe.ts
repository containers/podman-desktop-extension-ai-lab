import type { Readable } from 'svelte/store';
import { derived, readable } from 'svelte/store';
import { MSG_NEW_RECIPE_STATE, MSG_TASKS_UPDATE } from '@shared/Messages';
import { rpcBrowser, studioClient } from '/@/utils/client';
import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';

export const recipes: Readable<Map<string, RecipeStatus>> = readable<Map<string, RecipeStatus>>(
  new Map<string, RecipeStatus>(),
  set => {
    const sub = rpcBrowser.subscribe(MSG_NEW_RECIPE_STATE, msg => {
      set(msg);
    });

    const pull = () => {
      studioClient.getPullingStatuses().then(state => {
        set(state);
      });
    }

    // Initialize the store manually
    pull();

    // when the tasks are updated we pull the recipe updates
    const tasks = rpcBrowser.subscribe(MSG_TASKS_UPDATE, _ => {
      pull();
    })

    return () => {
      sub.unsubscribe();
      tasks.unsubscribe();
    };
  },
);

export const modelsPulling = derived(recipes, $recipes => {
  return Array.from($recipes.values())
    .flatMap(recipe => recipe.tasks)
    .filter(task => 'model-pulling' in (task.labels || {}));
});
