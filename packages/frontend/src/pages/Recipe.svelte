<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import { studioClient } from '/@/utils/client';
import Tab from '/@/lib/Tab.svelte';
import Route from '/@/Route.svelte';
import Card from '/@/lib/Card.svelte';
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import { getIcon } from '/@/utils/categoriesUtils';
import RecipeModels from './RecipeModels.svelte';
import { catalog } from '/@/stores/catalog';
import RecipeDetails from '/@/lib/RecipeDetails.svelte';

export let recipeId: string;

// The recipe model provided
$: recipe = $catalog.recipes.find(r => r.id === recipeId);
$: categories = $catalog.categories;

// Send recipe info to telemetry
let recipeTelemetry: string | undefined = undefined;
$: if (recipe && recipe.id !== recipeTelemetry) {
  recipeTelemetry = recipe.id;
  studioClient.telemetryLogUsage('recipe.open', { 'recipe.id': recipe.id, 'recipe.name': recipe.name });
}
</script>
<style>
  .recipe-container {
    display: grid;
    grid-template-columns: 1fr auto;
  }
  .recipe-content {
    grid-column: 1;
  }
  .recipe-details {
    grid-column: 2;
  }

  @media (max-width: 900px) {
    .recipe-container {
      grid-template-columns: 1fr;
    }
    .recipe-details {
      grid-row: 1;
      grid-column: 1;
      order: -1;
    }
  }
</style>

<NavPage title="{recipe?.name || ''}" icon="{getIcon(recipe?.icon)}" searchEnabled="{false}" contentBackground='bg-charcoal-500'>
  <svelte:fragment slot="tabs">
    <Tab title="Summary" url="{recipeId}" />
    <Tab title="Models" url="{recipeId}/models" />
  </svelte:fragment>
  <svelte:fragment slot="content">
    <!-- recipe container -->
    <div class="grid w-full recipe-container">
      <!-- recipe content -->
      <div class="p-5 inline-grid recipe-content">
        <Route path="/" breadcrumb="Summary" >
          <MarkdownRenderer source="{recipe?.readme}"/>
        </Route>
        <Route path="/models" breadcrumb="History">
          <RecipeModels modelsIds={recipe?.models} />
        </Route>
      </div>
      <!-- recipe details -->
      <div class="inline-grid recipe-details">
        <RecipeDetails recipeId={recipeId} />
      </div>
    </div>
  </svelte:fragment>
  <svelte:fragment slot="subtitle">
    <div class="mt-2">
      {#each recipe?.categories || [] as categoryId}
        <Card
          title="{categories.find(category => category.id === categoryId)?.name || '?'}"
          classes="bg-charcoal-800 p-1 text-xs w-fit"
        />
      {/each}
    </div>
  </svelte:fragment>
</NavPage>
