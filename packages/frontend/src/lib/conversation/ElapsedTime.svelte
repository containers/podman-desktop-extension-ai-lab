<script lang="ts">
import {
  type AssistantChat,
  type ChatMessage,
  isAssistantChat,
  isPendingChat,
} from '@shared/models/IPlaygroundMessage';

export let message: ChatMessage;

function elapsedTime(msg: AssistantChat): string {
  if (isPendingChat(msg)) {
    return ((Date.now() - msg.timestamp) / 1000).toFixed(1);
  } else if (msg.completed) {
    return ((msg.completed - msg.timestamp) / 1000).toFixed(1);
  } else {
    // should not happen
    return '';
  }
}
</script>

{#if isAssistantChat(message)}
  <div class="text-[var(--pd-content-header)] text-right select-none" aria-label="elapsed">
    {elapsedTime(message)} s
  </div>
{/if}
