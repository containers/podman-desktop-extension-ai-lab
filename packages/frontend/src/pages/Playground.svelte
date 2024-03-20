<script lang="ts">
import { conversations } from '../stores/conversations';
import { studioClient } from '/@/utils/client';
import {
  isAssistantChat,
  type ChatMessage,
  type UserChat,
  isPendingChat,
  isUserChat,
  type AssistantChat,
} from '@shared/src/models/IPlaygroundMessage';
import NavPage from '../lib/NavPage.svelte';
import { catalog } from '../stores/catalog';
import Button from '../lib/button/Button.svelte';
import { afterUpdate } from 'svelte';

export let conversationId: string;
let prompt: string;
let sendEnabled = false;
let scrollable: Element;
let errorMsg = '';

$: conversation = $conversations.find(conversation => conversation.id === conversationId);
$: model = $catalog.models.find(model => model.id === conversation?.modelId);
$: {
  if (conversation?.messages.length) {
    const latest = conversation.messages[conversation.messages.length - 1];
    if (isAssistantChat(latest) && !isPendingChat(latest)) {
      sendEnabled = true;
    }
  } else {
    sendEnabled = true;
  }
}

const roleNames = {
  system: 'System',
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
  } else if (isUserChat(message)) {
    const msg = message as UserChat;
    return msg.content?.split('\n') ?? [];
  }
  return [];
}

function askPlayground() {
  errorMsg = '';
  sendEnabled = false;
  studioClient.submitPlaygroundMessage(conversationId, prompt).catch((err: unknown) => {
    errorMsg = String(err);
    sendEnabled = true;
  });
  prompt = '';
}

afterUpdate(() => {
  if (!conversation?.messages.length) {
    return;
  }
  const latest = conversation.messages[conversation.messages.length - 1];
  if (isUserChat(latest) || (isAssistantChat(latest) && isPendingChat(latest))) {
    scrollToBottom(scrollable);
  }
});

async function scrollToBottom(element: Element) {
  element.scroll?.({ top: element.scrollHeight, behavior: 'smooth' });
}

function elapsedTime(msg: AssistantChat): string {
  if (isPendingChat(msg)) {
    return ((Date.now() - msg.timestamp) / 1000).toFixed(1);
  } else if (!!msg.completed) {
    return ((msg.completed - msg.timestamp) / 1000).toFixed(1);
  } else {
    // should not happen
    return '';
  }
}
</script>

{#if conversation}
  <NavPage title="{conversation.name}" searchEnabled="{false}">
    <svelte:fragment slot="subtitle">{model?.name}</svelte:fragment>
    <svelte:fragment slot="content">
      <div class="flex flex-col w-full h-full">
        <div bind:this="{scrollable}" aria-label="conversation" class="w-full h-full overflow-auto">
          {#if conversation.messages}
            <ul class="p-4">
              {#each conversation.messages as message}
                <li class="m-4">
                  <div class="text-lg" class:text-right="{isAssistantChat(message)}">{roleNames[message.role]}</div>
                  <div
                    class="p-4 rounded-md"
                    class:bg-charcoal-400="{isUserChat(message)}"
                    class:bg-charcoal-900="{isAssistantChat(message)}"
                    class:ml-8="{isAssistantChat(message)}"
                    class:mr-8="{isUserChat(message)}">
                    {#each getMessageParagraphs(message) as paragraph}
                      <p>{paragraph}</p>
                    {/each}
                  </div>
                  {#if isAssistantChat(message)}
                    <div class="text-sm text-gray-400 text-right" aria-label="elapsed">{elapsedTime(message)} s</div>
                  {/if}
                  <div></div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
        {#if errorMsg}
          <div class="text-red-500 text-sm p-2">{errorMsg}</div>
        {/if}
        <div class="flex flex-row flex-none w-full">
          <textarea
            aria-label="prompt"
            bind:value="{prompt}"
            rows="2"
            class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"
            placeholder="Type your prompt here"></textarea>

          <div class="flex-none text-right m-4">
            <Button
              inProgress="{!sendEnabled}"
              on:click="{() => askPlayground()}"
              title="{!sendEnabled ? 'Please wait, assistant is replying' : ''}">Send prompt</Button>
          </div>
        </div>
      </div>
    </svelte:fragment>
  </NavPage>
{/if}
