<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import { onDestroy, onMount } from 'svelte';
import { studioClient } from '/@/utils/client';
import type { Recipe as RecipeModel } from '@shared/models/IRecipe';
import Tab from '/@/lib/Tab.svelte';
import Route from '/@/Route.svelte';
import type { Category } from '@shared/models/ICategory';
import Card from '/@/lib/Card.svelte';
import MarkdownRenderer from '/@/lib/MarkdownRenderer.svelte';
import Fa from 'svelte-fa';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';
import Button from '/@/lib/button/Button.svelte';
import { getDisplayName } from '/@/utils/versionControlUtils';
import type { RecipeStatus } from '@shared/models/IRecipeStatus';

export let recipeId: string;

// The recipe model provided
let recipe: RecipeModel | undefined = undefined;

// By default, we are loading the recipe information
let loading: boolean = true;

// The pulling tasks
let recipeStatus: RecipeStatus | undefined = undefined;

$: categories = [] as Category[]

let intervalId: ReturnType<typeof setInterval> | undefined = undefined;

onMount(async () => {
  recipe = await studioClient.getRecipeById(recipeId);
  categories = await studioClient.getCategories();

  // Pulling update
  intervalId = setInterval(async () => {
    recipeStatus = await studioClient.getPullingStatus(recipeId);
    loading = false;
  }, 1000);
})

const onPullingRequest = async () => {
  loading = true;
  await studioClient.pullApplication(recipeId);
}

onDestroy(() => {
  if(intervalId !== undefined) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
});
</script>

<NavPage title="{recipe?.name || ''}">
  <svelte:fragment slot="tabs">
    <Tab title="Summary" url="{recipeId}" />
    <Tab title="Models" url="{recipeId}/models" />
  </svelte:fragment>
  <svelte:fragment slot="content">
    <Route path="/" breadcrumb="Summary" >
      <div class="flex flex-row w-full">
        <div class="flex-grow p-5">
          <MarkdownRenderer source="{recipe?.readme}"/>
        </div>
        <!-- Right column -->
        <div class="border-l border-l-charcoal-400 px-5 min-w-80">
          <Card classes="bg-charcoal-800 mt-5">
            <div slot="content" class="text-base font-normal p-2">
              <div class="text-base mb-2">Repository</div>
              <div class="cursor-pointer flex text-nowrap items-center">
                <Fa size="20" icon="{faGithub}"/>
                <div class="ml-2">
                  <a href="{recipe?.repository}" target="_blank">{getDisplayName(recipe?.repository)}</a>
                </div>
              </div>
            </div>
          </Card>
          {#if recipeStatus !== undefined && recipeStatus.tasks.length > 0}
            <Card classes="bg-charcoal-800 mt-4">
              <div slot="content" class="text-base font-normal p-2">
                <div class="text-base mb-2">Repository</div>
                <TasksProgress tasks="{recipeStatus.tasks}"/>
              </div>
            </Card>
          {:else}
            <Button
              on:click={() => onPullingRequest()}
              disabled="{loading}"
              inProgress="{loading}"
              class="w-full mt-4 p-2"
              icon="{faDownload}"
            >
              {#if loading}Loading{:else}Pull application{/if}
            </Button>
          {/if}
        </div>
      </div>
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
