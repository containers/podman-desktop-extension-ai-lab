<script lang="ts">
import type { EnvironmentCell } from '/@/pages/environments';

export let object: EnvironmentCell;
</script>

<div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
  {object.envState.pod.Name}
</div>
