<script lang="ts">
import Card from '/@/lib/Card.svelte';
import type { Category } from '@shared/models/ICategory';
import RecipeCard from '/@/lib/RecipeCard.svelte';
import type { Recipe } from '@shared/models/IRecipe';

export let category: Category;
export let recipes: Recipe[];
</script>

<Card title={category.name} classes="{$$props.class} font-medium mt-4">
  <div slot="content" class="w-full">
    {#if recipes.length === 0}
      <div class="text-gray-400 mt-2">There is no recipe in this category for now ! Come back later</div>
    {/if}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      {#each recipes as recipe (recipe.id)}
        <RecipeCard recipe={recipe} />
      {/each}
    </div>
  </div>
</Card>
