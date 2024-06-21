<script lang="ts">
import type { ApplicationState } from '@shared/src/models/IApplicationState';

export let object: ApplicationState;
</script>

<div class="text-sm text-[var(--pd-table-body-text)] overflow-hidden text-ellipsis">
  {object.pod.Name}
</div>
