<script lang="ts">
import { filesize } from 'filesize';
import type { ModelInfoUI } from '/@/models/ModelInfoUI';
export let object: ModelInfoUI;
</script>

<div class="text-xs text-gray-700 flex-flex-row">
  {#if object.file?.size}
    <div>{filesize(object.file.size)}</div>
  {/if}
</div>
