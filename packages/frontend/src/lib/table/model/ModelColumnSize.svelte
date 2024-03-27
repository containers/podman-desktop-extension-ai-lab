<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { filesize } from 'filesize';
export let object: ModelInfo;
</script>

<div class="text-xs text-gray-700 flex-flex-row">
  {#if object.file?.size}
    <div>{filesize(object.file.size)}</div>
  {/if}
</div>
