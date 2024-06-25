<script lang="ts">
import type { InferenceServerInfo } from '@shared/src/models/IInference';
export let object: InferenceServerInfo;
</script>

{#if object.models.length === 1}
  <span class="text-sm text-[var(--pd-table-body-text)]">
    {object.models[0].name}
  </span>
{:else}
  <ul>
    {#each object.models as model}
      <li class="text-sm text-[var(--pd-table-body-text)]">{model.name}</li>
    {/each}
  </ul>
{/if}
