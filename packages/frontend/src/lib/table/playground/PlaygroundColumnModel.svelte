<script lang="ts">
import type { Conversation } from '@shared/src/models/IPlaygroundMessage';
export let object: Conversation;
import { catalog } from '/@/stores/catalog';

$: name = $catalog.models.find(r => r.id === object.modelId)?.name;
</script>

<div class="text-sm text-gray-300 overflow-hidden text-ellipsis">
  {name}
</div>
