<script lang="ts">
import type { Conversation } from '@shared/models/IPlaygroundMessage';
import ConversationActions from '../../conversation/ConversationActions.svelte';

export let object: Conversation;
</script>

<ConversationActions conversation={object} />
