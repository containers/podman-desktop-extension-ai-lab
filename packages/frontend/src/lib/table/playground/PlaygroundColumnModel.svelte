<script lang="ts">
import type { PlaygroundV2 } from '@shared/src/models/IPlaygroundV2';
export let object: PlaygroundV2;
import { catalog } from '/@/stores/catalog';

$: name = $catalog.models.find(r => r.id === object.modelId)?.name;
</script>

<div class="text-sm text-gray-300 overflow-hidden text-ellipsis">
  {name}
</div>
