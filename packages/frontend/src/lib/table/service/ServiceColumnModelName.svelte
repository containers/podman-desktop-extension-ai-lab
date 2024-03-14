<script lang="ts">
import type { InferenceServer } from '@shared/src/models/IInference';
export let object: InferenceServer;
</script>

<span class="text-sm text-gray-700">
  {#if object.models.length === 1}
    {object.models[0].name}
  {:else}
    <ul>
      {#each object.models as model}
        <li>{model.name}</li>
      {/each}
    </ul>
  {/if}
</span>
