<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import { studioClient } from '/@/utils/client';
import Tab from '/@/lib/Tab.svelte';
import Route from '/@/Route.svelte';
import Card from '/@/lib/Card.svelte';
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import Fa from 'svelte-fa';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faPlay, faRefresh } from '@fortawesome/free-solid-svg-icons';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';
import Button from '/@/lib/button/Button.svelte';
import { getDisplayName } from '/@/utils/versionControlUtils';
import { getIcon } from '/@/utils/categoriesUtils';
import RecipeModels from './RecipeModels.svelte';
import { catalog } from '/@/stores/catalog';
import { recipes } from '/@/stores/recipe';

export let recipeId: string;

// The recipe model provided
$: recipe = $catalog.recipes.find(r => r.id === recipeId);
$: categories = $catalog.categories;
$: recipeStatus = $recipes.get(recipeId);

// this will be selected by the user, init with the default model (the first in the catalog recipe?)
$: selectedModelId = recipe?.models?.[0];
$: model = $catalog.models.find(m => m.id === selectedModelId);

const onPullingRequest = async () => {
  await studioClient.pullApplication(recipeId);
}

const onClickRepository = () => {
  if (recipe) {
    studioClient.openURL(recipe.repository);
  }
}

$: applicationDetailsPanel = 'block';
$: applicationDetailsPanelToggle = 'hidden';
function toggle() {
  if (applicationDetailsPanel === 'block') {
    applicationDetailsPanel = 'hidden';
    applicationDetailsPanelToggle = 'block';
  } else {
    applicationDetailsPanel = 'block';
    applicationDetailsPanelToggle = 'hidden';
  }
}
</script>

<NavPage title="{recipe?.name || ''}" icon="{getIcon(recipe?.icon)}" searchEnabled="{false}" contentBackground='bg-charcoal-500'>
  <svelte:fragment slot="tabs">
    <Tab title="Summary" url="{recipeId}" />
    <Tab title="Models" url="{recipeId}/models" />
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex flex-row w-full">
      <Route path="/" breadcrumb="Summary" >        
        <div class="flex-grow p-5">
          <MarkdownRenderer source="{recipe?.readme}"/>
        </div>          
      </Route>
      <Route path="/models" breadcrumb="History">
        <RecipeModels modelsIds={recipe?.models} />
      </Route>
      <!-- Right column -->
      <div class="w-[375px] min-w-[375px] h-fit bg-charcoal-800 rounded-md mt-4 {applicationDetailsPanel}">
        <div class="flex flex-col my-5 w-[340px] space-y-4 mx-auto">
          <div class="w-full flex flex-row justify-between">
            <span class="text-base">Application Details</span>
            <button on:click={toggle}><i class="fas fa-angle-right text-gray-900"></i></button>
          </div>
          
          <div class="w-full bg-charcoal-600 rounded-md p-4">
            {#if recipeStatus !== undefined && recipeStatus.tasks.length > 0}
              {#if recipeStatus.state === 'error'}
              <Button
                on:click={() => onPullingRequest()}
                class="w-full p-2"
                icon="{faRefresh}"
              >Retry</Button>
              {:else if recipeStatus.state === 'loading'}
              <Button
                inProgress={true}
                class="w-[300px] p-2 mx-auto"
                icon="{faPlay}"
              >
                Loading
              </Button>
              {:else if recipeStatus.state === 'running'}
              <Button
                inProgress={true}
                class="w-[300px] p-2 mx-auto"
                icon="{faPlay}"
              >
                Running
              </Button>
              {/if}
            {:else}
              <Button
                on:click={() => onPullingRequest()}
                class="w-[300px] p-2 mx-auto"
                icon="{faPlay}"
              >
                Run application
              </Button>
            {/if}
            
            <div class="text-xs text-gray-700 mt-3">
              This will git clone the application, download the model, build images, and run the application as a pod locally.
            </div>
            {#if recipeStatus !== undefined && recipeStatus.tasks.length > 0}
              <div class="mt-4 text-sm font-normal px-4 py-2">
                <TasksProgress tasks="{recipeStatus.tasks}"/>
              </div>
            {/if}
          </div>
          
          <div class="flex flex-col w-full space-y-4 bg-charcoal-600 p-4">
            {#if model}
            <div class="flex flex-col space-y-2">
              <div class="text-base">Model</div>
              <div class="flex flex-row space-x-2">
                <div class="bg-charcoal-900 min-w-[200px] grow flex flex-col p-2 rounded-md space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{model?.name}</span>
                    {#if recipe?.models?.[0] === model.id}
                    <i class="fas fa-star fa-xs text-gray-900"></i>
                    {/if}            
                  </div>
                  {#if model?.license}
                  <div class="flex flex-row space-x-2">
                    <div class="bg-charcoal-400 text-gray-600 text-xs font-thin px-2.5 py-0.5 rounded-md">
                      {model.license}
                    </div>
                  </div>
                  {/if}
                </div>
              </div>
              <div class="px-2 text-xs text-gray-700">
                * This is the default, recommended model for this recipe.
                You can swap for a different compatible model.
              </div>
            </div>
            {/if}
            <div class="flex flex-col space-y-2">
              <div class="text-base">Repository</div>
              <div class="cursor-pointer flex text-nowrap items-center">
                <Fa size="20" icon="{faGithub}"/>
                <div class="text-sm ml-2">
                  <a on:click={onClickRepository}>{getDisplayName(recipe?.repository)}</a>
                </div>
              </div>
            </div>                            
          </div>
          
        </div>
      </div>
      <div class="bg-charcoal-800 mt-4 p-4 rounded-md h-fit {applicationDetailsPanelToggle}">
        <button on:click={toggle}><i class="fas fa-angle-left text-gray-900"></i></button>
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
