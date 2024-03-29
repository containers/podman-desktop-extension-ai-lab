<script lang="ts">
import type { ApplicationState } from '@shared/src/models/IApplicationState';

export let object: ApplicationState;
</script>

<div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
  {object.pod.Name}
</div>
