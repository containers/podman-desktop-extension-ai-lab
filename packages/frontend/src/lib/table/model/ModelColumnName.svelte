<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { router } from 'tinro';
export let object: ModelInfo;

function openDetails() {
  router.goto(`/model/${object.id}`);
}
</script>

<button on:click="{() => openDetails()}">
  <div class="text-sm text-gray-300 overflow-hidden text-ellipsis">
    {object.name}
  </div>
</button>
