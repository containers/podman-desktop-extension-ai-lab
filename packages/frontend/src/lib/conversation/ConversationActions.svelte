<script lang="ts">
import { studioClient } from '/@/utils/client';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';
import type { Conversation } from '@shared/models/IPlaygroundMessage';

export let conversation: Conversation;
export let detailed: boolean = false;

function deleteConversation(): void {
  studioClient.requestDeleteConversation(conversation.id).catch((err: unknown) => {
    console.error('Something went wrong while trying to delete conversation', err);
  });
}
</script>

<ListItemButtonIcon icon={faTrash} detailed={detailed} onClick={deleteConversation} title="Delete conversation" />
