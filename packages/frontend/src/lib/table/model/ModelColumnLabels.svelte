<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { faMemory, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { filesize } from 'filesize';
import Badge from '../../Badge.svelte';
export let object: ModelInfo;
</script>

<div class="text-sm">
  <div class="flex gap-x-2">
    <Badge icon={faMemory} content="RAM usage: {object.memory ? filesize(object.memory, { base: 2 }) : 'N/A'}" />
    <Badge icon={faMicrochip} content={object.hw} />
  </div>
</div>
