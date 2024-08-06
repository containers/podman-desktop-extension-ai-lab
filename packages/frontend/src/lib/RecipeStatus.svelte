<script lang="ts">
import type { Recipe } from '@shared/src/models/IRecipe';
import Fa from 'svelte-fa';
import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import { faCircleCheck, faDownload } from '@fortawesome/free-solid-svg-icons';
import { Spinner } from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';
import { Tooltip } from '@podman-desktop/ui-svelte';

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
  <Tooltip>
    {#if localRepository}
      <div aria-label="chevron down icon" class="text-dustypurple-700 p-2 w-10 text-center">
        <Fa size="lg" icon={faCircleCheck} />
      </div>
    {:else}
      <button
        on:click={onClick}
        disabled={loading}
        class="border-2 justify-center relative rounded border-[var(--pd-button-secondary)] text-[var(--pd-button-secondary)] hover:bg-[var(--pd-button-secondary-hover)] hover:border-[var(--pd-button-secondary-hover)] hover:text-[var(--pd-button-text)] w-10 p-2 text-center cursor-pointer flex flex-row">
        {#if loading}
          <Spinner class="text-[var(--pd-table-body-text-highlight)]" size="1em" />
        {:else}
          <div aria-label="download icon">
            <Fa size="sm" icon={faDownload} />
          </div>
        {/if}
      </button>
    {/if}
    <svelte:fragment slot="tip">
      <span class="inline-block py-2 px-4 rounded-md"
        >{loading ? 'Cloning...' : localRepository ? 'Recipe cloned' : 'Clone recipe'}</span>
    </svelte:fragment>
  </Tooltip>
{/key}
