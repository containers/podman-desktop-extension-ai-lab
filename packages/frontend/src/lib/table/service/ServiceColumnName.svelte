<script lang="ts">
import { router } from 'tinro';
import type { InferenceServer } from '@shared/src/models/IInference';

export let object: InferenceServer;

function openDetails(): void {
  router.goto(`/service/${object.container.containerId}`);
}
</script>

<button
  title="Open service details"
  class="text-[var(--pd-table-body-text-highlight)] w-full text-ellipsis overflow-hidden"
  on:click={openDetails}>
  {object.container.containerId}
</button>
