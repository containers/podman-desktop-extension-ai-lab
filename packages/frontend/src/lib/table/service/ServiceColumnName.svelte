<script lang="ts">
import { router } from 'tinro';
import type { InferenceServer } from '@shared/src/models/IInference';
export let object: InferenceServer;

function openDetails() {
  router.goto(`/service/${object.container.containerId}`);
}
</script>

<button title="Open service details" class="text-sm text-gray-700" on:click="{() => openDetails()}">
  {object.container.containerId}
</button>
