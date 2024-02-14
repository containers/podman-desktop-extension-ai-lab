<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { router } from 'tinro';
export let object: ModelInfo;

function openDetails() {
  router.goto(`/model/${object.id}`);
}
</script>

<button class="text-sm text-gray-700" on:click="{() => openDetails()}">
  {object.name}
</button>
