<script lang="ts">
import { faExclamationCircle, faPlus, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import NavPage from '../lib/NavPage.svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { modelsInfo } from '/@/stores/modelsInfo';
import Fa from 'svelte-fa';
import Button from '../lib/button/Button.svelte';
import { studioClient } from '../utils/client';
import { router } from 'tinro';
let localModels: ModelInfo[];
$: localModels = $modelsInfo.filter(model => model.file);
let modelId: string | undefined = undefined;
let submitting: boolean = false;
let playgroundName: string;

function openModelsPage() {
  router.goto(`/models`);
}

function onNameInput(event: Event) {
  playgroundName = (event.target as HTMLInputElement).value || '';
}

function submit() {
  const model: ModelInfo | undefined = localModels.find(model => model.id === modelId);
  if (model === undefined) throw new Error('model id not valid.');
  // disable submit button
  submitting = true;
  studioClient
    .createPlayground(playgroundName, model)
    .catch(err => {
      console.error('Something wrong while trying to create the playground.', err);
    })
    .finally(() => {
      submitting = false;
      router.goto('/playgrounds');
    });
}
</script>

<NavPage icon="{faPlus}" title="New Playground environment" searchEnabled="{false}">
  <svelte:fragment slot="content">
    <div class="bg-charcoal-800 m-5 pt-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg w-full h-fit">
      <div class="w-full">
        <!-- playground name input -->
        <label for="playgroundName" class="block mb-2 text-sm font-bold text-gray-400">Playground name</label>
        <input
          id="playgroundName"
          class="w-full p-2 outline-none text-sm bg-charcoal-600 rounded-sm text-gray-700 placeholder-gray-700"
          type="text"
          name="playgroundName"
          on:input="{onNameInput}"
          placeholder="Leave blank to generate a name"
          aria-label="playgroundName" />

        <!-- model input -->
        <label for="model" class="pt-4 block mb-2 text-sm font-bold text-gray-400">Model</label>
        <select
          required
          id="providerChoice"
          bind:value="{modelId}"
          class="border text-sm rounded-lg w-full focus:ring-purple-500 focus:border-purple-500 block p-2.5 bg-charcoal-900 border-charcoal-900 placeholder-gray-700 text-white"
          name="providerChoice">
          {#each localModels as model}
            <option class="my-1" value="{model.id}">{model.name}</option>
          {/each}
        </select>
        {#if localModels.length === 0}
          <div class="text-red-500 p-1 flex flex-row items-center">
            <Fa size="1.1x" class="cursor-pointer text-red-500" icon="{faExclamationCircle}" />
            <div role="alert" aria-label="Error Message Content" class="ml-2">
              You don't have any models downloaded. You can download them in <a
                href="{'javascript:void(0);'}"
                class="underline"
                title="Models page"
                on:click="{openModelsPage}">models page</a
              >.
            </div>
          </div>
        {/if}
      </div>
      <footer>
        <div class="w-full flex flex-col">
          <Button
            title="Create playground"
            inProgress="{submitting}"
            on:click="{submit}"
            disabled="{!modelId}"
            icon="{faPlusCircle}">
            Create playground
          </Button>
        </div>
      </footer>
    </div>
  </svelte:fragment>
</NavPage>
