<script lang="ts">
import { conversations } from '../stores/conversations';
import { studioClient } from '/@/utils/client';
import {
  isAssistantChat,
  type ChatMessage,
  type UserChat,
  isPendingChat,
  isUserChat,
} from '@shared/src/models/IPlaygroundMessage';
import NavPage from '../lib/NavPage.svelte';
import { playgrounds } from '../stores/playgrounds-v2';
import { catalog } from '../stores/catalog';
import Button from '../lib/button/Button.svelte';

export let playgroundId: string;
let prompt: string;
let sendEnabled = false;

$: conversation = $conversations.find(conversation => conversation.id === playgroundId);
$: playground = $playgrounds.find(playground => playground.id === playgroundId);
$: model = $catalog.models.find(model => model.id === playground?.modelId);
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
      console.log('assistant content', message.content);
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
  studioClient.submitPlaygroundMessage(playgroundId, prompt);
  sendEnabled = false;
  prompt = '';
}
</script>

{#if playground}
  <NavPage title="{playground?.name}" searchEnabled="{false}">
    <svelte:fragment slot="subtitle">{model?.name}</svelte:fragment>
    <svelte:fragment slot="content">
      <div class="flex flex-col w-full h-full">
        <div class="w-full h-full overflow-auto">
          {#if conversation?.messages}
            <ul class="p-4">
              {#each conversation?.messages as message}
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
                </li>
              {/each}
            </ul>
          {/if}
        </div>
        <div class="flex flex-row flex-none w-full">
          <textarea
            aria-label="prompt"
            bind:value="{prompt}"
            rows="2"
            class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"
            placeholder="Type your prompt here"></textarea>

          <div class="flex-none text-right m-4">
            <Button disabled="{!sendEnabled}" on:click="{() => askPlayground()}">Send prompt</Button>
          </div>
        </div>
      </div>
    </svelte:fragment>
  </NavPage>
{/if}
