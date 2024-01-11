<script lang="ts">
  import type { ModelInfo } from '@shared/models/IModelInfo';
  import Button from '../lib/button/Button.svelte';
  export let model: ModelInfo | undefined;
</script>

<div class="m-4 w-full flew flex-col">
  <div class="mb-2">Prompt</div>
  <textarea
    rows="4"
    class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"
    placeholder="Type your prompt here"></textarea>
  
  <div class="mt-4 text-right"> 
    <Button>Send Request</Button>
  </div>

  <div class="mt-4 mb-2">Output</div>
  <textarea
    readonly
    disabled
    rows="4"
    class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"></textarea>
</div>


