<script lang="ts">
import type { EnvironmentCell } from '/@/pages/environments';
import { catalog } from '/@/stores/catalog';

export let object: EnvironmentCell;

$: name = $catalog.models.find(r => r.id === object.modelId)?.name;
</script>

<div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
  {name}
</div>
