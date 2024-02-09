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

<NavPage title="{recipe?.name || ''}" icon="{getIcon(recipe?.icon)}" searchEnabled="{false}" contentBackground='bg-charcoal-500'>
  <svelte:fragment slot="tabs">
    <Tab title="Summary" url="{recipeId}" />
    <Tab title="Models" url="{recipeId}/models" />
  </svelte:fragment>
  <svelte:fragment slot="content">
    <!-- recipe container -->
    <div class="grid w-full lg:grid-cols-[1fr_auto] max-lg:grid-cols-[auto]">
      <!-- recipe content -->
      <div class="p-5 inline-grid">
        <Route path="/" breadcrumb="Summary" >
          <MarkdownRenderer source="{recipe?.readme}"/>
        </Route>
        <Route path="/models" breadcrumb="History">
          <RecipeModels modelsIds={recipe?.models} />
        </Route>
      </div>
      <!-- recipe details -->
      <div class="inline-grid max-lg:order-first">
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
