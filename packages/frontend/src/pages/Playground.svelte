<script lang="ts">
import { conversations } from '../stores/conversations';
import { studioClient } from '/@/utils/client';
import { isAssistantChat, isPendingChat, isUserChat } from '@shared/src/models/IPlaygroundMessage';
import NavPage from '../lib/NavPage.svelte';
import { playgrounds } from '../stores/playgrounds-v2';
import { catalog } from '../stores/catalog';
import Button from '../lib/button/Button.svelte';
import { afterUpdate } from 'svelte';
import ContentDetailsLayout from '../lib/ContentDetailsLayout.svelte';
import RangeInput from '../lib/RangeInput.svelte';

import { default as ChatMessageComponent } from '../lib/conversation/ChatMessage.svelte';

export let playgroundId: string;
let prompt: string;
let sendEnabled = false;
let scrollable: Element;
let lastIsUserMessage = false;
let errorMsg = '';

// settings
let systemPrompt: string = '';
let temperature = 0.8;
let max_tokens = -1;
let top_p = 0.5;

$: conversation = $conversations.find(conversation => conversation.id === playgroundId);
$: playground = $playgrounds.find(playground => playground.id === playgroundId);
$: model = $catalog.models.find(model => model.id === playground?.modelId);
$: {
  if (conversation?.messages.length) {
    const latest = conversation.messages[conversation.messages.length - 1];
    if (isSystemPrompt(latest) || (isAssistantChat(latest) && !isPendingChat(latest))) {
      sendEnabled = true;
    }
    lastIsUserMessage = isUserChat(latest);
  } else {
    sendEnabled = true;
  }
}

function askPlayground() {
  errorMsg = '';
  sendEnabled = false;
  studioClient
    .submitPlaygroundMessage(playgroundId, prompt, systemPrompt, {
      temperature,
      max_tokens,
      top_p,
    })
    .catch((err: unknown) => {
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
</script>

{#if playground}
  <NavPage title="{playground?.name}" searchEnabled="{false}" contentBackground="bg-charcoal-500">
    <svelte:fragment slot="subtitle">{model?.name}</svelte:fragment>
    <svelte:fragment slot="content">
      <div class="flex flex-col w-full h-full">
        <div class="h-full overflow-auto" bind:this="{scrollable}">
          <ContentDetailsLayout detailsTitle="Settings" detailsLabel="settings">
            <svelte:fragment slot="content">
              <div class="flex flex-col w-full h-full">
                <div aria-label="conversation" class="w-full h-full">
                  {#if conversation?.messages}
                    <ul>
                      {#each conversation?.messages as message}
                        <li>
                          <ChatMessageComponent message="{message}" />
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              </div>
            </svelte:fragment>
            <svelte:fragment slot="details">
              <div class="text-gray-800 text-xs">Next prompt will use these settings</div>
              <div class="bg-charcoal-600 w-full rounded-md text-xs p-4">
                <div class="mb-4 flex flex-col">Model Parameters</div>
                <div class="flex flex-col space-y-4">
                  <RangeInput name="temperature" min="0" max="2" step="0.1" bind:value="{temperature}" />
                  <RangeInput name="max tokens" min="-1" max="32768" step="1" bind:value="{max_tokens}" />
                  <RangeInput name="top-p" min="0" max="1" step="0.1" bind:value="{top_p}" />
                </div>
              </div>
            </svelte:fragment>
          </ContentDetailsLayout>
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
