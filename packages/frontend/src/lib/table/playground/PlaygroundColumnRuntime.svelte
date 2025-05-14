<script lang="ts">
import { inferenceTypeLabel } from '@shared/models/IInference';
import Badge from '../../Badge.svelte';
import type { ConversationWithBackend } from '/@/stores/conversations';

export let object: ConversationWithBackend;
</script>

<Badge content={inferenceTypeLabel(object.backend)} />
