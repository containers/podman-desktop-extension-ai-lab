<script lang="ts">
import type { EnvironmentCell } from '/@/pages/environments';
import { catalog } from '/@/stores/catalog';
import { displayPorts } from '/@/utils/printers';
import { faSquareArrowUpRight } from '@fortawesome/free-solid-svg-icons';
import { studioClient } from '/@/utils/client';
import Fa from 'svelte-fa';

export let object: EnvironmentCell;

$: name = $catalog.recipes.find(r => r.id === object.recipeId)?.name;

function openApp(port: number) {
  studioClient.openURL(`http://localhost:${port}`).catch((err: unknown) => {
    console.error('Something went wrong while opening url', err);
  });
}
</script>

<div class="flex flex-col">
  <div class="text-sm text-gray-300 overflow-hidden text-ellipsis">
    {name}
    {#if object.appPorts}
      {#each object.appPorts as port}
        <button title="{`open AI App on port ${port}`}" on:click="{() => openApp(port)}">
          <Fa class="h-4 w-6" icon="{faSquareArrowUpRight}" />
        </button>
      {/each}
    {/if}
  </div>
  <div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
    {displayPorts(object.appPorts)}
  </div>
</div>
