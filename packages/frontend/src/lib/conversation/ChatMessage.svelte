<script lang="ts">
import {
  type ChatMessage,
  isAssistantChat,
  isAssistantToolCall,
  isSystemPrompt,
  isUserChat,
} from '@shared/models/IPlaygroundMessage';
import ElapsedTime from '/@/lib/conversation/ElapsedTime.svelte';

export let message: ChatMessage;

const roles = {
  system: 'System prompt',
  user: 'User',
  assistant: 'Assistant',
};

function getMessageParagraphs(message: ChatMessage): string[] {
  if (!isAssistantToolCall(message)) {
    return (message.content as string)?.split('\n') ?? [];
  }
  return [];
}
</script>

<div>
  <div class="text-[var(--pd-content-header)]" class:text-right={isAssistantChat(message)}>
    {roles[message.role]}
  </div>
  <div
    class="p-4 rounded-md text-[var(--pd-content-card-text)]"
    class:bg-[var(--pd-content-card-bg)]={isUserChat(message)}
    class:bg-[var(--pd-content-bg)]={isSystemPrompt(message)}
    class:bg-[var(--pd-content-card-inset-bg)]={isAssistantChat(message)}
    class:ml-8={isAssistantChat(message)}
    class:mr-8={isUserChat(message)}>
    {#each getMessageParagraphs(message) as paragraph (paragraph)}
      <p>{paragraph}</p>
    {/each}
  </div>
  <ElapsedTime message={message} />
  <div></div>
</div>
