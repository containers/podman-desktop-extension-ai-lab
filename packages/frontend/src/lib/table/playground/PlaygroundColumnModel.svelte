<script lang="ts">
import type { PlaygroundInfo } from '/@/pages/playgrounds';
export let object: PlaygroundInfo;
import { catalog } from '/@/stores/catalog';

$: name = $catalog.models.find(r => r.id === object.modelId)?.name;
</script>

<div class="text-sm text-gray-300 overflow-hidden text-ellipsis">
  {name}
</div>
