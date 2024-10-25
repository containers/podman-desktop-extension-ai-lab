<script lang="ts">
import type { Recipe } from '@shared/src/models/IRecipe';
import { router } from 'tinro';
import { faArrowUpRightFromSquare, faFolder } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';
import { localRepositories } from '../stores/localRepositories';
import { findLocalRepositoryByRecipeId } from '/@/utils/localRepositoriesUtils';
import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import RecipeStatus from '/@/lib/RecipeStatus.svelte';

export let recipe: Recipe;

let localPath: LocalRepository | undefined = undefined;
$: localPath = findLocalRepositoryByRecipeId($localRepositories, recipe.id);

function handleClick(): void {
  router.goto(`/recipe/${recipe.id}`);
}
</script>

<div class="no-underline">
  <div
    class="bg-[var(--pd-content-card-bg)] hover:bg-[var(--pd-content-card-hover-bg)] flex-grow p-4 h-full rounded-md flex-nowrap flex flex-col"
    role="region"
    aria-label={recipe.name}>
    <!-- body -->
    <div class="flex flex-row text-base grow">
      <!-- left column -->
      <div class="flex flex-col grow">
        <span class="text-[var(--pd-content-card-header-text)]">{recipe.name}</span>
        <span class="text-sm text-[var(--pd-content-card-text)]">{recipe.description}</span>
      </div>

      <!-- right column -->
      <div>
        <RecipeStatus recipe={recipe} localRepository={localPath} />
      </div>
    </div>

    {#if localPath}
      <div
        class="bg-[var(--pd-label-bg)] text-[var(--pd-label-text)] max-w-full rounded-md p-2 mb-2 flex flex-row w-min h-min text-sm text-nowrap items-center">
        <Fa class="mr-2" icon={faFolder} />
        <span class="overflow-x-hidden text-ellipsis max-w-full">
          {localPath.path}
        </span>
      </div>
    {/if}

    <!-- footer -->
    <div class="flex flex-row">
      <!-- version -->
      <div
        class="flex-grow text-[var(--pd-content-card-text)] opacity-50 whitespace-nowrap overflow-x-hidden text-ellipsis">
        {#if recipe.ref}
          <span>{recipe.ref}</span>
        {/if}
      </div>

      <!-- more details -->
      <button on:click={handleClick}>
        <div class="flex flex-row items-center text-[var(--pd-link)]">
          <Fa class="mr-2" icon={faArrowUpRightFromSquare} />
          <span> More details </span>
        </div>
      </button>
    </div>
  </div>
</div>
