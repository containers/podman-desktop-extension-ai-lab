<script lang="ts">
import { type AssistantChat, type ToolCall } from '@shared/models/IPlaygroundMessage';
import ElapsedTime from '/@/lib/conversation/ElapsedTime.svelte';

interface Props {
  message: AssistantChat;
}
let { message }: Props = $props();
let toolCall = $derived(message.content as ToolCall);
let result: string | object | undefined = $derived(toolCall?.result);

let open: boolean = $state(false);
const toggle = (): void => {
  open = !open;
};
</script>

<div>
  <div data-testid="tool-call-role" class="text-[var(--pd-content-header)] text-right">Assistant</div>
  <div
    data-testid="tool-call-container"
    class="p-4 rounded-md text-[var(--pd-content-card-text)] bg-[var(--pd-content-card-inset-bg)] ml-8 flex flex-col">
    <div data-testid="tool-call-summary" class="flex gap-1.5 justify-items-center">
      <i class="fa-solid fa-wrench before:h-full before:flex before:items-center"></i>
      <span>Used tool:</span>
      <strong>{toolCall.toolName}</strong>
      <div class="flex-grow"></div>
      <button
        data-testid="tool-call-show-details"
        onclick={toggle}
        aria-label="Show tool details"
        title="Show tool details">
        <i
          class="fas text-[var(--pd-content-card-icon)] fa-angle-up transition-all before:h-full before:flex before:items-center"
          class:rotate-180={open}></i>
      </button>
    </div>
    <div
      data-testid="tool-call-details"
      class="overflow-hidden transition-[height]"
      class:mt-2={open}
      class:h-fit={open}
      class:h-0={!open}
      style="interpolate-size: allow-keywords">
      <div>Arguments</div>
      <pre data-testid="tool-call-arguments" class="text-xs p-1">{JSON.stringify(
          toolCall.args,
          undefined,
          2,
        ).trim()}</pre>
      {#if toolCall?.result}
        <div>Result</div>
        <pre data-testid="tool-call-result" class="text-xs p-1">{typeof result === 'string'
            ? result.trim()
            : JSON.stringify(toolCall.result, undefined, 2).trim()}</pre>
      {/if}
    </div>
  </div>
  <ElapsedTime message={message} />
</div>
