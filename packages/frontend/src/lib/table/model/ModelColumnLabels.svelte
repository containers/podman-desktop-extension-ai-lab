<script lang="ts">
import { faMemory, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';
import { filesize } from 'filesize';
import type { ModelInfoUI } from '/@/models/ModelInfoUI';
export let object: ModelInfoUI;
</script>

<div class="text-sm text-gray-700">
  <div class="flex gap-x-2">
    <div
      class="bg-charcoal-600 rounded-md px-2 py-1 flex flex-row w-min h-min text-xs text-charcoal-100 text-nowrap items-center">
      <Fa class="mr-2" icon="{faMemory}" />
      RAM usage: {object.memory ? filesize(object.memory, { base: 2 }) : 'N/A'}
    </div>
    <div
      class="bg-charcoal-600 rounded-md px-2 py-1 flex flex-row w-min h-min text-xs text-charcoal-100 text-nowrap items-center">
      <Fa class="mr-2" icon="{faMicrochip}" />
      {object.hw}
    </div>
  </div>
</div>
