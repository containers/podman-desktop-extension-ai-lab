<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { filesize } from 'filesize';
export let object: ModelInfo;
</script>

<div class="text-sm text-gray-700">
  {#if object.file?.size}
    {filesize(object.file.size)}
  {/if}
</div>
