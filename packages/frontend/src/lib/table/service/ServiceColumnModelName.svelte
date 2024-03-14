<script lang="ts">
import type { InferenceServer } from '@shared/src/models/IInference';
export let object: InferenceServer;
</script>


{#if object.models.length === 1}
  <span class="text-sm text-gray-700">
  {object.models[0].name}
  </span>
{:else}
  <ul>
    {#each object.models as model}
      <li class="text-sm text-gray-700">{model.name}</li>
    {/each}
  </ul>
{/if}
