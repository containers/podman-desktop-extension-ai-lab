<script lang="ts">
import type { InstructlabSession } from '@shared/src/models/IInstructlab';

export let object: InstructlabSession;
</script>

<div class="text-[var(--pd-table-body-text)] w-full text-ellipsis overflow-hidden">
  {object.name}
</div>
