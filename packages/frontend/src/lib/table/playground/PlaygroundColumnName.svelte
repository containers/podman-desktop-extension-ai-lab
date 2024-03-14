<script lang="ts">
import { router } from 'tinro';
import type { PlaygroundInfo } from '/@/pages/playgrounds';
export let object: PlaygroundInfo;

function openDetails() {
  router.goto(`/playground/${object.id}`);
}
</script>

<button on:click="{() => openDetails()}">
  <div class="text-sm text-gray-300 overflow-hidden text-ellipsis">
    {object.name}
  </div>
</button>
