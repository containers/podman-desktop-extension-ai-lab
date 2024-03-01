<script lang="ts">
import type { ApplicationCell } from '../../../pages/applications';

export let object: ApplicationCell;
</script>

<div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
  {object.envState.pod.Name}
</div>
