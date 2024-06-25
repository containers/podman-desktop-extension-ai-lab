<script lang="ts">
import { router } from 'tinro';
import type { InferenceServerInfo } from '@shared/src/models/IInference';
export let object: InferenceServerInfo;

function openDetails() {
  router.goto(`/service/${object.container.containerId}`);
}
</script>

<button
  title="Open service details"
  class="text-sm text-[var(--pd-table-body-text-highlight)] w-full text-ellipsis overflow-hidden"
  on:click="{() => openDetails()}">
  {object.container.containerId}
</button>
