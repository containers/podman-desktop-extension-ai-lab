<script lang="ts">
import { faCheck, faClose, faEdit, faTerminal } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';
import { studioClient } from '/@/utils/client';
import { type Conversation, isSystemPrompt, isUserChat } from '@shared/src/models/IPlaygroundMessage';
import { onMount } from 'svelte';

export let conversation: Conversation;

let systemPrompt: string | undefined = undefined;
let editing: boolean = false;
let error: string | undefined;
let disabled: boolean = conversation.messages.some(isUserChat);

const onButtonClick = () => {
  if (editing) {
    if (systemPrompt !== undefined && systemPrompt.length > 1) {
      error = undefined;
      studioClient.setPlaygroundSystemPrompt(conversation.id, systemPrompt).catch((err: unknown) => {
        error = `Something went wrong while setting the system prompt: ${String(err)}`;
      });
    } else {
      error = 'System prompt is too short.';
      return; // keep the editing state
    }
  }
  editing = !editing;
};

const onClear = () => {
  systemPrompt = undefined;
  editing = false;
  error = undefined;

  // If pressed on clear - deleting the system prompt
  if (conversation.messages.some(isSystemPrompt)) {
    studioClient.setPlaygroundSystemPrompt(conversation.id, undefined).catch((err: unknown) => {
      error = `Something went wrong while setting the system prompt: ${String(err)}`;
    });
  }
};

const onChange = () => {
  error = undefined;
};

onMount(() => {
  systemPrompt = conversation.messages.find(isSystemPrompt)?.content;
});
</script>

<div class="bg-[var(--pd-content-card-bg)] text-[var(--pd-content-card-text)] rounded-md w-full px-4 py-2">
  <div class="flex items-center gap-x-2">
    <Fa icon={faTerminal} />
    <span class="grow">Define a system prompt</span>
    <button class:hidden={!editing} on:click={onClear} title="Clear">
      <Fa icon={faClose} />
    </button>
    <button class:text-gray-800={disabled} disabled={disabled} on:click={onButtonClick} title="Edit system prompt">
      <Fa icon={editing ? faCheck : faEdit} />
    </button>
  </div>
  <div>
    <textarea
      class:hidden={!editing}
      on:input={onChange}
      aria-label="system-prompt-textarea"
      bind:value={systemPrompt}
      class="w-full p-2 mt-2 outline-none bg-[var(--pd-content-card-inset-bg)] rounded-sm text-[var(--pd-content-card-text)] placeholder-[var(--pd-content-card-text)] resize-none"
      rows="3"
      placeholder="Provide system prompt to define general context, instructions or guidelines to be used with each query"
    ></textarea>
    <span role="alert" class="text-[var(--pd-input-field-error-text)] pt-1" class:hidden={!error}>{error}</span>
  </div>
  <span class="mt-2 text-[var(--pd-content-card-text)]" class:hidden={editing || !systemPrompt}>{systemPrompt}</span>
</div>
