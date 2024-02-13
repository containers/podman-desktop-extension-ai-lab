<script lang="ts">
import Card from '/@/lib/Card.svelte';
import { getIcon } from '/@/utils/categoriesUtils';
import type { Category } from '@shared/src/models/ICategory';
import { catalog } from '/@/stores/catalog';

export let category: Category;

$: categories = $catalog.categories;
$: recipes = $catalog.recipes.filter(r => r.categories.includes(category.id)).map(r => ({ ...r, icon: category.id }));

export let primaryBackground: string = 'bg-charcoal-800';
export let secondaryBackground: string = 'bg-charcoal-700';

export let displayCategory: boolean = true;
export let displayDescription: boolean = true;
</script>

<Card title="{category.name}" classes="{primaryBackground} {$$props.class} text-xl font-medium mt-4">
  <div slot="content" class="w-full">
    <div class="grid grid-cols-3 gap-4 mt-4">
      {#if recipes.length === 0}
        <span class="text-xs text-gray-400">There is no models in this category for now ! Come back later</span>
      {/if}
      {#each recipes as recipe}
        <Card
          href="/recipes/{recipe.id}"
          title="{recipe.name}"
          icon="{getIcon(recipe.icon)}"
          classes="{secondaryBackground} flex-grow p-4">
          <div slot="content" class="text-base font-normal mt-2">
            {#if displayCategory}
              {#each recipe.categories as categoryId}
                <Card
                  title="{categories.find(category => category.id === categoryId)?.name || '?'}"
                  classes="{primaryBackground} p-1"
                  primaryBackground="{primaryBackground}" />
              {/each}
            {/if}
            {#if displayDescription}
              <span>{recipe.description}</span>
            {/if}
          </div>
        </Card>
      {/each}
    </div>
  </div>
</Card>
