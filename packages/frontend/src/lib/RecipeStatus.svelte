<script lang="ts">
import type { Recipe } from '@shared/src/models/IRecipe';
import Fa from 'svelte-fa';
import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import { faCircleChevronDown, faDownload } from '@fortawesome/free-solid-svg-icons';
import { Spinner } from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';

export let recipe: Recipe;
export let localRepository: LocalRepository | undefined;

let loading: boolean = false;

function onClick(): void {
  if (loading || localRepository) return;
  loading = true;

  studioClient
    .cloneApplication(recipe.id)
    .catch((err: unknown) => {
      console.error(err);
    })
    .finally(() => {
      loading = false;
    });
}
</script>

{#key loading}
  <button
    on:click="{onClick}"
    disabled="{loading}"
    class="border-2 justify-center relative rounded border-dustypurple-700 text-dustypurple-700 hover:bg-charcoal-800 hover:text-dustypurple-600 w-10 p-2 text-center cursor-pointer flex flex-row">
    {#if localRepository}
      <div aria-label="chevron down icon">
        <Fa size="sm" icon="{faCircleChevronDown}" />
      </div>
    {:else if loading}
      <Spinner size="1em" />
    {:else}
      <div aria-label="download icon">
        <Fa size="sm" icon="{faDownload}" />
      </div>
    {/if}
  </button>
{/key}
