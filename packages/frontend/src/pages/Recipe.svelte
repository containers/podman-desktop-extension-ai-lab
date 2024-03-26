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
import ContentDetailsLayout from '../lib/ContentDetailsLayout.svelte';

export let recipeId: string;

// The recipe model provided
$: recipe = $catalog.recipes.find(r => r.id === recipeId);
$: categories = $catalog.categories;
let selectedModelId: string;
$: selectedModelId = recipe?.models?.[0] ?? '';

// Send recipe info to telemetry
let recipeTelemetry: string | undefined = undefined;
$: if (recipe && recipe.id !== recipeTelemetry) {
  recipeTelemetry = recipe.id;
  studioClient.telemetryLogUsage('recipe.open', { 'recipe.id': recipe.id, 'recipe.name': recipe.name });
}

function setSelectedModel(modelId: string) {
  selectedModelId = modelId;
}
</script>

<NavPage
  lastPage="{{ name: 'Recipes', path: '/recipes' }}"
  title="{recipe?.name || ''}"
  icon="{getIcon(recipe?.icon)}"
  searchEnabled="{false}"
  contentBackground="bg-charcoal-500">
  <svelte:fragment slot="tabs">
    <Tab title="Summary" url="{recipeId}" />
    <Tab title="Models" url="{recipeId}/models" />
  </svelte:fragment>
  <svelte:fragment slot="content">
    <ContentDetailsLayout detailsTitle="AI App Details" detailsLabel="application details">
      <svelte:fragment slot="content">
        <Route path="/">
          <MarkdownRenderer source="{recipe?.readme}" />
        </Route>
        <Route path="/models">
          <RecipeModels
            modelsIds="{recipe?.models}"
            selectedModelId="{selectedModelId}"
            setSelectedModel="{setSelectedModel}" />
        </Route>
      </svelte:fragment>
      <svelte:fragment slot="details">
        <RecipeDetails recipeId="{recipeId}" modelId="{selectedModelId}" />
      </svelte:fragment>
    </ContentDetailsLayout>
  </svelte:fragment>
  <svelte:fragment slot="subtitle">
    <div class="mt-2">
      {#each recipe?.categories || [] as categoryId}
        <Card
          title="{categories.find(category => category.id === categoryId)?.name || '?'}"
          classes="bg-charcoal-800 p-1 text-xs w-fit" />
      {/each}
    </div>
  </svelte:fragment>
</NavPage>
