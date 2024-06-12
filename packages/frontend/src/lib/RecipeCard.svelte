<script lang="ts">
import type { Recipe } from '@shared/src/models/IRecipe';
import { router } from 'tinro';
import { faArrowUpRightFromSquare, faFolder } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';
import { localRepositories } from '../stores/localRepositories';
import { findLocalRepositoryByRecipeId } from '/@/utils/localRepositoriesUtils';
import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import RecipeStatus from '/@/lib/RecipeStatus.svelte';

export let background: string = 'bg-charcoal-600';

export let recipe: Recipe;

let localPath: LocalRepository | undefined = undefined;
$: localPath = findLocalRepositoryByRecipeId($localRepositories, recipe.id);
</script>

<div class="no-underline">
  <div
    class="{background} hover:bg-charcoal-500 flex-grow p-4 h-full rounded-md flex-nowrap flex flex-col"
    role="region">
    <!-- body -->
    <div class="flex flex-row text-base grow">
      <!-- left column -->
      <div class="flex flex-col grow">
        <span class="">{recipe.name}</span>
        <span class="text-sm text-gray-700">{recipe.description}</span>
      </div>

      <!-- right column -->
      <div>
        <RecipeStatus recipe="{recipe}" localRepository="{localPath}" />
      </div>
    </div>

    {#if localPath}
      <div
        class="bg-charcoal-600 max-w-full rounded-md p-2 mb-2 flex flex-row w-min h-min text-xs text-nowrap items-center">
        <Fa class="mr-2" icon="{faFolder}" />
        <span class="overflow-x-hidden text-ellipsis max-w-full">
          {localPath.path}
        </span>
      </div>
    {/if}

    <!-- footer -->
    <div class="flex flex-row">
      <!-- version -->
      <div class="flex-grow">
        {#if recipe.ref}
          <span>{recipe.ref}</span>
        {/if}
      </div>

      <!-- more details -->
      <button on:click="{() => router.goto(`/recipe/${recipe.id}`)}">
        <div class="flex flex-row items-center">
          <Fa class="mr-2" icon="{faArrowUpRightFromSquare}" />
          <span> More details </span>
        </div>
      </button>
    </div>
  </div>
</div>
