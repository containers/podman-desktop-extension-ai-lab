<script lang="ts">
import RecipesCard from '/@/lib/RecipesCard.svelte';
import { catalog } from '/@/stores/catalog';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { Category } from '@shared/src/models/ICategory';
import { Dropdown, NavPage } from '@podman-desktop/ui-svelte';
import { studioClient } from '../utils/client';
import type { CatalogFilterKey, RecipeFilters } from '@shared/src/models/FilterRecipesResult';

// filters available in the dropdowns for the user to select
let choices: RecipeFilters = $state({});

// filters selected by the user
let filters = $state<RecipeFilters>({});

// the filtered recipes
let recipes: Recipe[] = $state([]);

// categoryDict is the list of categories in the catalog, derived from the catalog store
let categoryDict: { [k: string]: Category } = $derived(
  Object.fromEntries($catalog.categories.map(category => [category.id, category])),
);

// call filterRecipes every time the filters change
// and update the recipes and choices states with the result
$effect(() => {
  (async (): Promise<void> => {
    if (!filters) {
      return;
    }
    const snapshotFilters = $state.snapshot(filters);
    const result = await studioClient.filterRecipes(snapshotFilters);
    recipes = result.result;
    choices = result.choices;
  })().catch((err: unknown) => {
    console.error('unable to filter recipes with filters', filters, err);
  });
});

const UNCLASSIFIED: Category = {
  id: 'unclassified',
  name: 'Unclassified',
};

// compute the recipes by category
// - when categoryDict is initially set
// - every time `recipes` state changes
let groups: Map<Category, Recipe[]> = $derived.by(() => {
  if (!Object.keys(categoryDict).length) {
    return new Map();
  }
  const output: Map<Category, Recipe[]> = new Map();
  for (const recipe of recipes) {
    if (recipe.categories.length === 0) {
      output.set(UNCLASSIFIED, [...(output.get(UNCLASSIFIED) ?? []), recipe]);
      continue;
    }
    // iterate over all categories
    for (const categoryId of recipe.categories) {
      let key: Category;
      if (categoryId in categoryDict) {
        key = categoryDict[categoryId];
      } else {
        key = UNCLASSIFIED;
      }

      output.set(key, [...(output.get(key) ?? []), recipe]);
    }
  }
  return output;
});

function onFilterChange(filter: CatalogFilterKey, v: unknown): void {
  if (typeof v === 'string') {
    if (v.length) {
      filters[filter] = [v];
    } else {
      delete filters[filter];
    }
  }
}

// convert a list of choices provided by the backend to a list of options acceptable by the Dropdown component, adding an empty choice
function choicesToOptions(choices: string[] | undefined): { label: string; value: string }[] {
  return [{ label: '(no filter)', value: '' }, ...(choices?.map(l => ({ value: l, label: l })) ?? [])];
}

// add more filters here when the backend supports them
const filtersComponents: { label: string; key: CatalogFilterKey }[] = [
  { label: 'Tools', key: 'tools' },
  { label: 'Frameworks', key: 'frameworks' },
  { label: 'Languages', key: 'languages' },
];
</script>

<NavPage title="Recipe Catalog" searchEnabled={false}>
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="px-5 space-y-5">
        <div class="flex flex-row space-x-2">
          {#each filtersComponents as filterComponent}
            <div class="w-full">
              <label for={filterComponent.key} class="block mb-2 text-sm font-medium text-[var(--pd-modal-text)]"
                >{filterComponent.label}</label>
              <Dropdown
                id={filterComponent.key}
                options={choicesToOptions(choices[filterComponent.key])}
                onChange={(v): void => onFilterChange(filterComponent.key, v)}></Dropdown>
            </div>
          {/each}
        </div>
        {#if groups}
          {#each groups.entries() as [category, recipes]}
            <RecipesCard category={category} recipes={recipes} />
          {/each}
        {/if}
      </div>
    </div>
  </div>
</NavPage>
