<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import Button from '/@/lib/button/Button.svelte';
import { faExclamationCircle, faPlus, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { modelsInfo } from '/@/stores/modelsInfo';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import Fa from 'svelte-fa';
import { router } from 'tinro';
import { onMount } from 'svelte';
import { studioClient } from '/@/utils/client';

let submitting: boolean = false;

let localModels: ModelInfo[];
$: localModels = $modelsInfo.filter(model => model.file);

let containerPort: number | undefined = undefined;
let modelId: string | undefined = undefined;

const onContainerPortInput = (event: Event): void => {
  const raw = (event.target as HTMLInputElement).value;
  try {
    containerPort = parseInt(raw);
  } catch (e: unknown) {
    console.warn('invalid value for container port', e);
    containerPort = 8888;
  }
};
const submit = () => {
  const model: ModelInfo | undefined = localModels.find(model => model.id === modelId);
  if (model === undefined) throw new Error('model id not valid.');
  if (containerPort === undefined) throw new Error('invalid container port');
  // disable submit button
  submitting = true;

  studioClient
    .createInferenceServer({
      modelsInfo: [model],
      port: containerPort,
      labels: {},
    })
    .catch(err => {
      console.error('Something wrong while trying to create the inference server.', err);
    })
    .finally(() => {
      submitting = false;
      router.goto('/services');
    });
};
const openModelsPage = () => {
  router.goto(`/models`);
};
onMount(async () => {
  containerPort = await studioClient.getHostFreePort();

  const queryModelId = router.location.query.get('model-id');
  if (queryModelId !== undefined && typeof queryModelId === 'string') {
    modelId = queryModelId;
  }
});
</script>

<NavPage icon="{faPlus}" title="Creating Model service" searchEnabled="{false}" loading="{containerPort === undefined}">
  <svelte:fragment slot="content">
    <div class="bg-charcoal-800 m-5 pt-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg w-full h-fit">
      <div class="w-full">
        <!-- model input -->
        <label for="model" class="pt-4 block mb-2 text-sm font-bold text-gray-400">Model</label>
        <select
          required
          bind:value="{modelId}"
          id="providerChoice"
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
        <!-- container port input -->
        <label for="containerPort" class="pt-4 block mb-2 text-sm font-bold text-gray-400">Container port</label>
        <input
          type="number"
          bind:value="{containerPort}"
          on:input="{onContainerPortInput}"
          class="w-full p-2 outline-none text-sm bg-charcoal-600 rounded-sm text-gray-700 placeholder-gray-700"
          placeholder="8888"
          name="containerPort"
          required />
      </div>
      <footer>
        <div class="w-full flex flex-col">
          <Button
            title="Create service"
            inProgress="{submitting}"
            on:click="{submit}"
            disabled="{!modelId}"
            icon="{faPlusCircle}">
            Create service
          </Button>
        </div>
      </footer>
    </div>
  </svelte:fragment>
</NavPage>
