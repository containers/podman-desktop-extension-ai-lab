<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import RecipesCard from '/@/lib/RecipesCard.svelte';
import { catalog } from '/@/stores/catalog';
import type { Recipe } from '@shared/src/models/IRecipe';
import { onMount } from 'svelte';
import type { Category } from '@shared/src/models/ICategory';

let groups: Map<Category, Recipe[]> = new Map();

const UNCLASSIFIED: Category = {
  id: 'unclassified',
  name: 'Unclassified',
};

onMount(() => {
  return catalog.subscribe(({ recipes, categories }) => {
    const categoryDict = Object.fromEntries(categories.map(category => [category.id, category]));

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

    groups = output;
  });
});
</script>

<NavPage title="Recipe Catalog" searchEnabled="{false}">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="px-5 space-y-5">
        {#each groups.entries() as [category, recipes]}
          <RecipesCard category="{category}" recipes="{recipes}" />
        {/each}
      </div>
    </div>
  </div>
</NavPage>
