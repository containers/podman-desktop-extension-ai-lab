<script lang="ts">
import {
  type AssistantChat,
  type ChatMessage,
  isAssistantChat,
  isPendingChat,
  isSystemPrompt,
  isUserChat,
} from '@shared/src/models/IPlaygroundMessage';

export let message: ChatMessage;

const roles = {
  system: 'System prompt',
  user: 'User',
  assistant: 'Assistant',
};

function getMessageParagraphs(message: ChatMessage): string[] {
  if (isAssistantChat(message)) {
    if (!isPendingChat(message)) {
      return message.content?.split('\n') ?? [];
    } else {
      return message.choices
        .map(choice => choice.content)
        .join('')
        .split('\n');
    }
  } else if (isUserChat(message) || isSystemPrompt(message)) {
    return message.content?.split('\n') ?? [];
  }
  return [];
}

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
  {#if isAssistantChat(message)}
    <div class="text-[var(--pd-content-header)] text-right" aria-label="elapsed">
      {elapsedTime(message)} s
    </div>
  {/if}
  <div></div>
</div>
