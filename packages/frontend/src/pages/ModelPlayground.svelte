<script lang="ts">
  import type { ModelInfo } from '@shared/models/IModelInfo';
  import type { ModelResponseChoice } from '@shared/models/IModelResponse';
  import Button from '../lib/button/Button.svelte';
  import { onMount } from 'svelte';
  import { studioClient } from '../utils/client';
  export let model: ModelInfo | undefined;

  let prompt = '';
  let result: ModelResponseChoice | undefined = undefined;
  let inProgress = false;

  onMount(() => {
    if (!model) {
      return;
    }
    studioClient.startPlayground(model.id);
  });

  async function askPlayground() {
    if (!model) {
      return;
    }
    inProgress = true;
    result = undefined;
    const res = await studioClient.askPlayground(model.id, prompt)
    inProgress = false;
    if (res.choices.length) {
      result = res.choices[0];
    }
  }
</script>

<div class="m-4 w-full flew flex-col">
  <div class="mb-2">Prompt</div>
  <textarea
    bind:value={prompt}
    rows="4"
    class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"
    placeholder="Type your prompt here"></textarea>
  
  <div class="mt-4 text-right"> 
    <Button inProgress={inProgress} on:click={() => askPlayground()}>Send Request</Button>
  </div>

  {#if result}
    <div class="mt-4 mb-2">Output</div>
    <textarea
      readonly
      disabled
      rows="20"
      bind:value={result.text}
      class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"></textarea>
  {/if}
</div>
