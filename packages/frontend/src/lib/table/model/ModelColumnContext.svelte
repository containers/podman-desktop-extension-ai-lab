<script lang="ts">
import type { ModelInfo } from '@shared/models/IModelInfo';

export let object: ModelInfo;
</script>

<div class="text-sm text-[var(--pd-table-body-text)] flex-flex-row">
  {#if object.maxCtxSize}
    <div title="Maximum context size (tokens)">{object.maxCtxSize}</div>
  {/if}
</div>
