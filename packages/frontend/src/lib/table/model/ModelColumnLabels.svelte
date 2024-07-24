<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { faMemory } from '@fortawesome/free-solid-svg-icons';
import { filesize } from 'filesize';
import Badge from '../../Badge.svelte';
export let object: ModelInfo;
</script>

<div>
  <div class="flex gap-x-2">
    <Badge icon={faMemory} content="RAM usage: {object.memory ? filesize(object.memory, { base: 2 }) : 'N/A'}" />
  </div>
</div>
