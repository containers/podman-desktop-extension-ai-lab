<script lang="ts">
import type { InstructlabSession } from '@shared/models/instructlab/IInstructlabSession';
import { router } from 'tinro';
import { catalog } from '/@/stores/catalog';

export let object: InstructlabSession;

$: name = $catalog.models.find(r => r.id === object.modelId)?.name;

function openDetails(): void {
  router.goto(`/model/${object.modelId}`);
}
</script>

<button title="Open model details" class="text-[var(--pd-table-body-text-highlight)]" on:click={openDetails}>
  {name}
</button>
