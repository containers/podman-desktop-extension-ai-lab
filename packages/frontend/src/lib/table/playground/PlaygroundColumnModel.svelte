<script lang="ts">
import type { Conversation } from '@shared/models/IPlaygroundMessage';

export let object: Conversation;
import { catalog } from '/@/stores/catalog';

$: name = $catalog.models.find(r => r.id === object.modelId)?.name;
</script>

<div class="text-[var(--pd-table-body-text)] overflow-hidden text-ellipsis">
  {name}
</div>
