<script lang="ts">
import type { InstructlabSession, InstructlabSessionStatus } from '@shared/src/models/instructlab/IInstructlabSession';

export let object: InstructlabSession;

function getStatusLabel(code: InstructlabSessionStatus): string {
  switch (code) {
    case 'fine-tuned':
      return 'Fine tuned';
    case 'generating-instructions':
      return 'Generating Instructions';
  }
}
</script>

<div class="text-[var(--pd-table-body-text)] whitespace-normal break-normal">
  {getStatusLabel(object.status)}
</div>
