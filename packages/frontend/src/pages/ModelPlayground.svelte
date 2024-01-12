<script lang="ts">
  import type { ModelInfo } from '@shared/models/IModelInfo';
  import Button from '../lib/button/Button.svelte';
  import { onMount } from 'svelte';
  import { studioClient } from '../utils/client';
  export let model: ModelInfo | undefined;

  let prompt = '';
  let result = '';
  let inProgress = false;

  onMount(() => {
    if (!model) {
      return;
    }
    console.log('starting model', model.id);
    studioClient.startPlayground(model.id);
  });

  async function askPlayground() {
    console.log('asking playground', prompt);
    if (!model) {
      return;
    }
    inProgress = true;
    result = '';
    const res = await studioClient.askPlayground(model.id, prompt)
    inProgress = false;
    result = res.choices[0].text;
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
    bind:value={result}
    class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"></textarea>
  {/if}
</div>


