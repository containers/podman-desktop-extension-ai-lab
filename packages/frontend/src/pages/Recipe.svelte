<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import { onMount } from 'svelte';
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
import type { Task } from '@shared/models/ITask';

export let recipeId: string;

let recipe: RecipeModel | undefined = undefined;
let pulling: Task[] = [];

$: categories = [] as Category[]


onMount(async () => {
  recipe = await studioClient.getRecipeById(recipeId);
  categories = await studioClient.getCategories();
})

const onPullingRequest = () => {
  studioClient.pullApplication(recipeId);
}
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
          <MarkdownRenderer/>
        </div>
        <!-- Right column -->
        <div class="border-l border-l-charcoal-400 px-5 max-w-80">
          <Card classes="bg-charcoal-800 mt-5">
            <div slot="content" class="text-base font-normal p-2">
              <div class="text-base mb-2">Repository</div>
              <div class="cursor-pointer flex text-nowrap items-center">
                <Fa size="20" icon="{faGithub}"/>
                <span class="ml-2">redhat-ia/{recipe?.id}</span>
              </div>
            </div>
          </Card>
          {#if pulling.length === 0}
            <button
              on:click={() => onPullingRequest()}
              class="mt-4 p-2 flex w-full flex-row hover:text-gray-300 bg-purple-500 hover:bg-charcoal-500 rounded-md cursor-pointer">
              <div class="mr-2">
                <Fa size="20" icon="{faDownload}"/>
              </div>
              Pull application
            </button>
          {:else}
            <Card classes="bg-charcoal-800 mt-4">
              <div slot="content" class="text-base font-normal p-2">
                <div class="text-base mb-2">Repository</div>
                <TasksProgress tasks="{pulling}"/>
              </div>
            </Card>
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
