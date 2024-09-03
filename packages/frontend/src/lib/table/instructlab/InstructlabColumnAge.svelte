<script lang="ts">
import { humanizeAge } from '/@/utils/dimensions';
import type { InstructlabSession } from '@shared/src/models/IInstructlab';

export let object: InstructlabSession;
</script>

<div class="text-[var(--pd-table-body-text)] overflow-hidden text-ellipsis">
  {humanizeAge(object.createdTime)}
</div>
