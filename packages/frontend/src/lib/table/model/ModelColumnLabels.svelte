<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { faMemory, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { filesize } from 'filesize';
import Chip from '../../Chip.svelte';
export let object: ModelInfo;
</script>

<div class="text-sm text-gray-700">
  <div class="flex gap-x-2">
    <Chip icon="{faMemory}" content="RAM usage: {object.memory ? filesize(object.memory, { base: 2 }) : 'N/A'}" />
    <Chip icon="{faMicrochip}" content="{object.hw}" />
  </div>
</div>
