<script lang="ts">
  import NavPage from '/@/lib/NavPage.svelte';
  import { onMount } from 'svelte';
  import { studioClient } from '/@/utils/client';
  import type { Recipe as RecipeModel } from '/@/models/IRecipe';
  import Tab from '/@/lib/Tab.svelte';
  import Route from '/@/Route.svelte';
  import type { Category } from '/@/models/ICategory';
  import Card from '/@/lib/Card.svelte';

  export let recipeId: string;

  let recipe: RecipeModel | undefined = undefined;
  $: categories = [] as Category[]

  onMount(async () => {
    recipe = await studioClient.getRecipeById(recipeId);
    categories = await studioClient.getCategories();
  })
</script>

<NavPage title="{recipe?.name || ''}">
  <svelte:fragment slot="tabs">
    <Tab title="Summary" url="{recipeId}" />
    <Tab title="Models" url="{recipeId}/models" />
  </svelte:fragment>
  <svelte:fragment slot="content">
    <Route path="/" breadcrumb="Summary" >
      <span>Summary: {recipe?.name}</span>
    </Route>
    <Route path="/models" breadcrumb="History">
      <span>Models: models</span>
    </Route>
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
