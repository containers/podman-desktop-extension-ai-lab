<script lang="ts">
import { catalog } from '/@/stores/catalog';
import { displayPorts } from '/@/utils/printers';
import { faSquareArrowUpRight } from '@fortawesome/free-solid-svg-icons';
import { studioClient } from '/@/utils/client';
import Fa from 'svelte-fa';
import type { ApplicationState } from '@shared/src/models/IApplicationState';

export let object: ApplicationState;

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
  </div>
  <div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
    {displayPorts(object.appPorts)}
  </div>
</div>
