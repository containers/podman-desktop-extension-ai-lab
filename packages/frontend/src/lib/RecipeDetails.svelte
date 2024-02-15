<script lang="ts">
import { faList } from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { getDisplayName } from '/@/utils/versionControlUtils';
import { recipes } from '/@/stores/recipe';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';
import Fa from 'svelte-fa';
import { studioClient } from '/@/utils/client';
import { catalog } from '/@/stores/catalog';
import { router } from 'tinro';
import { environmentStates } from '../stores/environment-states';
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';
import EnvironmentActions from './EnvironmentActions.svelte';
import Button from './button/Button.svelte';

export let recipeId: string;
export let modelId: string;

$: envState = $environmentStates.find((env: EnvironmentState) => env.recipeId === recipeId);
$: recipe = $catalog.recipes.find(r => r.id === recipeId);
$: recipeStatus = $recipes.get(recipeId);
$: model = $catalog.models.find(m => m.id === modelId);

let open: boolean = true;

const onClickRepository = () => {
  if (!recipe) return;

  studioClient.openURL(recipe.repository).catch((err: unknown) => {
    console.error('Something went wrong while opening url', err);
  });
};

const toggle = () => {
  console.log('on toggle', open);
  open = !open;
};
</script>

<div class="lg:my-5 max-lg:w-full max-lg:min-w-full" class:w-[375px]="{open}" class:min-w-[375px]="{open}">
  <div
    class:hidden="{!open}"
    class:block="{open}"
    class="h-fit lg:bg-charcoal-800 lg:rounded-l-md lg:mt-4 lg:py-4 max-lg:block"
    aria-label="application details panel">
    <div class="flex flex-col px-4 space-y-4 mx-auto">
      <div class="w-full flex flex-row justify-between max-lg:hidden">
        <span class="text-base">Application Details</span>
        <button on:click="{toggle}" aria-label="hide application details"
          ><i class="fas fa-angle-right text-gray-900"></i></button>
      </div>

      <div class="w-full bg-charcoal-600 rounded-md p-4">
        <div class="flex flex-row items-center">
          {#if envState}
            <div class="grow whitespace-nowrap overflow-hidden text-ellipsis text-sm text-gray-300">
              {envState.pod.Name}
            </div>
          {:else}
            <div class="grow whitespace-nowrap overflow-hidden text-ellipsis text-sm text-gray-500 italic">
              (no pod running)
            </div>
          {/if}
          <div class="shrink-0">
            <EnvironmentActions
              recipeId="{recipeId}"
              modelId="{modelId}"
              object="{envState}"
              tasks="{recipeStatus?.tasks}" />
          </div>
        </div>
        {#if recipeStatus !== undefined && recipeStatus.tasks.length > 0}
          <div class="mt-4 text-sm font-normal py-2">
            <TasksProgress tasks="{recipeStatus.tasks}" />
          </div>
        {/if}
      </div>

      <div class="flex flex-col w-full space-y-4 rounded-md bg-charcoal-600 p-4">
        {#if model}
          <div class="flex flex-col space-y-2">
            <div class="flex flex-row justify-between">
              <div class="text-base">Model</div>
              <div
                class="py-0.5"
                class:hidden="{$router.path === `/recipes/${recipeId}/models`}"
                aria-label="swap model panel">
                <Button
                  icon="{faList}"
                  on:click="{() => router.goto(`/recipes/${recipeId}/models`)}"
                  title="Go to the Models page to swap model"
                  aria-label="Go to Model"
                  class="h-full" />
              </div>
            </div>

            <div class="bg-charcoal-900 min-w-[200px] grow flex flex-col p-2 rounded-md space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-sm" aria-label="model-selected">{model?.name}</span>
                {#if recipe?.models?.[0] === model.id}
                  <i class="fas fa-star fa-xs text-gray-900" title="Recommended model"></i>
                {/if}
              </div>
              {#if model?.license}
                <div class="flex flex-row space-x-2">
                  <div
                    class="bg-charcoal-400 text-gray-600 text-xs font-thin px-2.5 py-0.5 rounded-md"
                    aria-label="license-model">
                    {model.license}
                  </div>
                </div>
              {/if}
            </div>
            <div class="px-2 text-xs text-gray-700" aria-label="model-warning">
              {#if recipe?.models?.[0] === model.id}
                * This is the default, recommended model for this recipe. You can <a
                  class="underline"
                  href="{`/recipes/${recipeId}/models`}">swap for a different compatible model</a
                >.
              {:else}
                * The default model for this recipe is {recipe?.models?.[0]}. You can
                <a class="underline" href="{`/recipes/${recipeId}/models`}"
                  >swap for {recipe?.models?.[0]} or a different compatible model</a
                >.
              {/if}
            </div>
          </div>
        {/if}
        <div class="flex flex-col space-y-2 w-[45px]">
          <div class="text-base">Repository</div>
          <div class="cursor-pointer flex text-nowrap items-center">
            <Fa size="20" icon="{faGithub}" />
            <div class="text-sm ml-2">
              <a on:click="{onClickRepository}">{getDisplayName(recipe?.repository)}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div
    class:hidden="{open}"
    class:block="{!open}"
    class="bg-charcoal-800 mt-4 p-4 rounded-md h-fit max-lg:hidden"
    aria-label="toggle application details">
    <button on:click="{toggle}" aria-label="show application details"
      ><i class="fas fa-angle-left text-gray-900"></i></button>
  </div>
</div>
