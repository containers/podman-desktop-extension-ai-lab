<script lang="ts">
import { faCheck, faEdit, faTerminal } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';
import { studioClient } from '/@/utils/client';
import { type Conversation, isSystemPrompt } from '@shared/src/models/IPlaygroundMessage';
import { onMount } from 'svelte';

export let conversation: Conversation;

let systemPrompt: string | undefined = undefined;
let editing: boolean = false;

const onButtonClick = () => {
  if (editing) {
    if (systemPrompt !== undefined && systemPrompt.length > 1) {
      studioClient.setPlaygroundSystemPrompt(conversation.id, systemPrompt);
    } else {
      // show error
    }
  }

  editing = !editing;
};

onMount(() => {
  systemPrompt = conversation.messages.find(isSystemPrompt)?.content;
});
</script>

<div class="bg-charcoal-800 rounded-md w-full px-4 py-2">
  <div class="flex items-center gap-x-2">
    <Fa icon="{faTerminal}" />
    <span class="grow">Define a system prompt</span>
    <button
      class:text-gray-800="{conversation.messages.length > 1}"
      disabled="{conversation.messages.length > 1}"
      on:click="{onButtonClick}"
      title="Set system prompt">
      <Fa icon="{editing ? faCheck : faEdit}" />
    </button>
  </div>
  <textarea
    class:hidden="{!editing}"
    aria-label="system-prompt-textarea"
    bind:value="{systemPrompt}"
    class="w-full p-2 outline-none text-sm bg-charcoal-600 rounded-sm text-gray-700 placeholder-gray-700 resize-none mt-2"
    rows="4"
    placeholder="Provide system prompt to define general context, instructions or guidelines to be used with each query"
  ></textarea>
  <span class="mt-2 text-gray-800" class:hidden="{editing || !systemPrompt}">{systemPrompt}</span>
</div>
