<script lang="ts">
import { humanizeAge } from '/@/utils/dimensions';
import type { ModelInfoUI } from '/@/models/ModelInfoUI';
export let object: ModelInfoUI;
</script>

<div class="text-sm text-gray-700">
  {#if object.file?.creation}
    {humanizeAge(object.file.creation.getTime() / 1000)}
  {/if}
</div>
