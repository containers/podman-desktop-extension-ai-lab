<script lang="ts">
import type { ModelInfo } from '@shared/models/IModelInfo';
import { router } from 'tinro';

export let object: ModelInfo;

function openDetails(): void {
  router.goto(`/model/${object.id}`);
}
</script>

<button class="flex flex-col w-full" title={object.name} on:click={openDetails} aria-label="Open Model Details">
  <div
    class="text-[var(--pd-table-body-text-highlight)] overflow-hidden text-ellipsis w-full text-left"
    aria-label="Model Name">
    {object.name}
  </div>
  {#if object.registry ?? object.license}
    <span class="text-sm text-[var(--pd-table-body-text)]" aria-label="Model Info"
      >{object.registry} - {object.license}</span>
  {/if}
  {#if !object.registry && !object.license && !object.url}
    <span class="text-sm text-[var(--pd-table-body-text)]" aria-label="Imported Model Info">Imported by User</span>
  {/if}
</button>
