<script lang="ts">
import Card from '/@/lib/Card.svelte';
import { getIcon } from '/@/utils/categoriesUtils';
import type { Category } from '@shared/src/models/ICategory';
import { catalog } from '/@/stores/catalog';

export let category: Category;

$: categories = $catalog.categories;
$: recipes = $catalog.recipes.filter(r => r.categories.includes(category.id));

export let primaryBackground: string = 'bg-charcoal-800';
export let secondaryBackground: string = 'bg-charcoal-700';

export let displayCategory: boolean = true;
export let displayDescription: boolean = true;
</script>

<Card title="{category.name}" classes="{primaryBackground} {$$props.class} text-sm font-medium mt-4">
  <div slot="content" class="w-full">
    {#if recipes.length === 0}
      <div class="text-xs text-gray-400 mt-2">There is no recipe in this category for now ! Come back later</div>
    {/if}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      {#each recipes as recipe}
        <Card
          href="/recipe/{recipe.id}"
          title="{recipe.name}"
          description="{displayDescription ? recipe.description : ''}"
          icon="{getIcon(recipe.icon)}"
          classes="{secondaryBackground} flex-grow p-4 h-full">
          <div slot="content" class="text-base font-normal mt-2">
            {#if displayCategory}
              {#each recipe.categories as categoryId}
                <Card
                  title="{categories.find(category => category.id === categoryId)?.name || '?'}"
                  classes="{primaryBackground} p-1"
                  primaryBackground="{primaryBackground}" />
              {/each}
            {/if}
          </div>
        </Card>
      {/each}
    </div>
  </div>
</Card>
