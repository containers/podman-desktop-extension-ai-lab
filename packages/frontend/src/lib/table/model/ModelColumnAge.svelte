<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { humanizeAge } from '/@/utils/dimensions';
export let object: ModelInfo;
</script>

<div class="text-[var(--pd-table-body-text)]">
  {#if object.file?.creation}
    {humanizeAge(object.file.creation.getTime() / 1000)}
  {/if}
</div>
