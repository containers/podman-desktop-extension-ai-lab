<script lang="ts">
import { faPlay, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { getDisplayName } from '/@/utils/versionControlUtils';
import { recipes } from '/@/stores/recipe';
import Button from '/@/lib/button/Button.svelte';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';
import Fa from 'svelte-fa';
import { studioClient } from '/@/utils/client';
import { catalog } from '/@/stores/catalog';

export let recipeId: string;

$: recipe = $catalog.recipes.find(r => r.id === recipeId);
$: recipeStatus = $recipes.get(recipeId);
// this will be selected by the user, init with the default model (the first in the catalog recipe?)
$: selectedModelId = recipe?.models?.[0];
$: model = $catalog.models.find(m => m.id === selectedModelId);

let open: boolean = true;

const onPullingRequest = () => {
  studioClient.pullApplication(recipeId)
    .catch((err: unknown) => {
      console.error('Something went wrong while pulling application', err);
    })
}

const onClickRepository = () => {
  if (!recipe)
    return;

  studioClient.openURL(recipe.repository)
    .catch((err: unknown) => {
      console.error('Something went wrong while opening url', err);
    })
}

const toggle = () => {
  console.log('on toggle', open);
  open = !open;
}

</script>

<div class="my-5" class:w-[375px]={open} class:min-w-[375px]={open}>
  <div class:hidden={!open} class:block={open} class="h-fit bg-charcoal-800 rounded-l-md mt-4 py-4" aria-label="application details panel">
    <div class="flex flex-col w-[340px] space-y-4 mx-auto">
      <div class="w-full flex flex-row justify-between">
        <span class="text-base">Application Details</span>
        <button on:click={toggle} aria-label="hide application details"><i class="fas fa-angle-right text-gray-900"></i></button>
      </div>

      <div class="w-full bg-charcoal-600 rounded-md p-4">
        {#if recipeStatus !== undefined && recipeStatus.tasks.length > 0}
          {#if recipeStatus.state === 'error'}
            <Button
              on:click={() => onPullingRequest()}
              class="w-full p-2"
              icon="{faRefresh}"
            >Retry</Button>
          {:else if recipeStatus.state === 'loading' || recipeStatus.state === 'running'}
            <Button
              inProgress={true}
              class="w-[300px] p-2 mx-auto"
              icon="{faPlay}"
            >
              {#if recipeStatus.state === 'loading'}Loading{:else}Running{/if}
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
          <div class="mt-4 text-sm font-normal py-2">
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
                  <span class="text-sm" aria-label="model-selected">{model?.name}</span>
                  {#if recipe?.models?.[0] === model.id}
                    <i class="fas fa-star fa-xs text-gray-900"></i>
                  {/if}
                </div>
                {#if model?.license}
                  <div class="flex flex-row space-x-2">
                    <div class="bg-charcoal-400 text-gray-600 text-xs font-thin px-2.5 py-0.5 rounded-md" aria-label="license-model">
                      {model.license}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
            {#if recipe?.models?.[0] === model.id}
              <div class="px-2 text-xs text-gray-700" aria-label="default-model-warning">
                * This is the default, recommended model for this recipe.
                You can swap for a different compatible model.
              </div>
            {/if}
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
  <div  class:hidden={open} class:block={!open} class="bg-charcoal-800 mt-4 p-4 rounded-md h-fit" aria-label="toggle application details">
    <button on:click={toggle} aria-label="show application details"><i class="fas fa-angle-left text-gray-900"></i></button>
  </div>
</div>
