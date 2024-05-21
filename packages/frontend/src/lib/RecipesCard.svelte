<script lang="ts">
import Card from '/@/lib/Card.svelte';
import type { Category } from '@shared/src/models/ICategory';
import RecipeCard from '/@/lib/RecipeCard.svelte';
import type { Recipe } from '@shared/src/models/IRecipe';

export let category: Category;
export let recipes: Recipe[];

export let primaryBackground: string = 'bg-charcoal-800';
export let secondaryBackground: string = 'bg-charcoal-700';

export let displayDescription: boolean = true;
</script>

<Card title="{category.name}" classes="{primaryBackground} {$$props.class} text-sm font-medium mt-4">
  <div slot="content" class="w-full">
    {#if recipes.length === 0}
      <div class="text-xs text-gray-400 mt-2">There is no recipe in this category for now ! Come back later</div>
    {/if}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      {#each recipes as recipe}
        <RecipeCard recipe="{recipe}" background="{secondaryBackground}" displayDescription="{displayDescription}" />
      {/each}
    </div>
  </div>
</Card>
