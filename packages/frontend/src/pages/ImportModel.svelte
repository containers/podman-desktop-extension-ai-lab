<script lang="ts">
import { faCircleInfo, faFileImport } from '@fortawesome/free-solid-svg-icons';
import { studioClient } from '../utils/client';
import { Uri } from '@shared/src/uri/Uri';
import type { LocalModelImportInfo } from '@shared/src/models/ILocalModelInfo';
import { Button, ErrorMessage, FormPage, Tooltip } from '@podman-desktop/ui-svelte';
import { InferenceType } from '@shared/src/models/IInference';
import Fa from 'svelte-fa';
import { getFilesFromDropEvent } from '/@/utils/fileUtils';
import { router } from 'tinro';

let localModel: LocalModelImportInfo | undefined = undefined;
let errorMessage: string = '';
let dragging: boolean = false;
let loading: boolean = false;

function onBackendChange(e: Event & { currentTarget: HTMLSelectElement }): void {
  if (!localModel) return;
  // update the local model
  localModel.backend = e.currentTarget.value as InferenceType;
}

async function submit(): Promise<void> {
  if (!localModel) return;

  loading = true;
  try {
    // ensure the model is valid
    await studioClient.validateLocalModel(localModel);

    // import the local model
    await studioClient.importModels([localModel]);
    router.goto(`/models/imported`);
  } catch (err: unknown) {
    errorMessage = `Something went wrong while importing the model: ${String(err)}`;
  } finally {
    loading = false;
  }
}

async function requestExplorerModal(): Promise<void> {
  dragging = false;
  errorMessage = '';
  try {
    const models = await studioClient.openDialog({
      title: 'Select model to import',
      selectors: ['openFile'],
      filters: [
        {
          name: 'GGUF files',
          extensions: ['gguf'],
        },
        {
          name: 'BIN files',
          extensions: ['bin'],
        },
      ],
    });
    if (!models || models.length !== 1) {
      return;
    }

    const mModel = Uri.revive(models[0]);
    const modelPath = mModel.path;
    const lastSlashIndex = modelPath.replace(/\\/g, '/').lastIndexOf('/') + 1;
    localModel = {
      path: mModel.path,
      name: mModel.path.substring(lastSlashIndex).replace('.gguf', ''),
      backend: InferenceType.LLAMA_CPP,
    };
  } catch (e) {
    localModel = undefined;
    errorMessage = `Error while adding models: ${String(e)}`;
  }
}

/**
 * User can drag&drop a file, this
 * function is the drag event handler
 * @param event
 */
async function onFile(event: DragEvent): Promise<void> {
  dragging = false;
  const files = getFilesFromDropEvent(event);
  if (files.length !== 1) {
    return;
  }
  localModel = {
    ...files[0],
    backend: InferenceType.LLAMA_CPP,
  };
}

export function goToUpPage(): void {
  router.goto('/models');
}
</script>

<FormPage
  title="Import Model"
  breadcrumbLeftPart="Models"
  breadcrumbRightPart="Import Model"
  breadcrumbTitle="Go back to Models Catalog"
  on:close="{goToUpPage}"
  on:breadcrumbClick="{goToUpPage}">
  <svelte:fragment slot="icon">
    <div class="rounded-full w-8 h-8 flex items-center justify-center">
      <Fa size="1.125x" class="text-[var(--pd-content-header-icon)]" icon="{faFileImport}" />
    </div>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex m-5 flex-col w-full">
      <!-- Error banner -->
      <div aria-label="importError">
        {#if errorMessage !== ''}
          <ErrorMessage class="py-2 text-sm" error="{errorMessage}" />
        {/if}
      </div>

      <!-- form -->
      <div class="bg-[var(--pd-content-card-bg)] space-y-6 px-8 sm:py-6 xl:py-8 rounded-lg h-fit">
        <div class="w-full">
          <!-- model input -->
          {#if localModel === undefined}
            <button
              aria-label="model input"
              title="Click to open file explorer"
              class:border-purple-400="{dragging}"
              class:border-gray-800="{!dragging}"
              on:click="{requestExplorerModal}"
              on:drop|preventDefault="{onFile}"
              on:dragover|preventDefault="{() => (dragging = true)}"
              on:dragleave|preventDefault="{() => (dragging = false)}"
              class="w-full cursor-pointer flex-col px-4 py-8 border-2 border-dashed rounded flex justify-center items-center">
              <Fa size="1.1x" class="cursor-pointer text-purple-400" icon="{faFileImport}" />
              <span>Drag & Drop or <strong class="text-purple-400">Choose file</strong> to import</span>
              <span class="text-gray-800 text-sm">Supported format: .guff, .bin</span>
            </button>
          {:else}
            <!-- showing path -->
            <label for="path" class="w-full block mb-2 text-sm font-bold text-gray-400">Path</label>
            <input
              class="flex w-full flex-col grow p-2 outline-none text-sm bg-transparent rounded-sm text-gray-700 placeholder-gray-700 border-charcoal-100 border-b mr-2"
              bind:value="{localModel.path}"
              name="path"
              aria-label="model path"
              readonly="{true}" />

            <!-- Model name -->
            <label for="name" class="pt-4 w-full block mb-2 text-sm font-bold text-gray-400">Name</label>
            <input
              bind:value="{localModel.name}"
              on:input="{event => {}}"
              name="name"
              aria-label="model importing name"
              placeholder="Model Name displayed"
              class="flex flex-col w-full grow p-2 outline-none text-sm bg-transparent rounded-sm text-gray-700 placeholder-gray-700 border-charcoal-100 border-b hover:border-purple-400 focus:border-purple-400 focus:border focus:rounded-lg focus:bg-charcoal-900" />

            <!-- selecting backend -->
            <div class="flex flex-row items-center justify-center">
              <label for="backend" class="pt-4 grow block mb-2 text-sm font-bold text-gray-400">Backend</label>
              <Tooltip left>
                <Fa size="1.1x" class="cursor-pointer" icon="{faCircleInfo}" />
                <svelte:fragment slot="tip">
                  <span class="inline-block py-2 px-4 rounded-md bg-charcoal-800 text-xs"
                    ><code>backends</code> represents the technology required to run the models.</span>
                </svelte:fragment>
              </Tooltip>
            </div>
            <select
              on:change="{onBackendChange}"
              name="backend"
              class="border text-sm rounded-lg w-full focus:ring-purple-500 focus:border-purple-500 block p-2.5 bg-charcoal-900 border-charcoal-900 placeholder-gray-700 text-white">
              {#each Object.values(InferenceType) as type}
                <option value="{type}">{type}</option>
              {/each}
            </select>
          {/if}
        </div>

        <!-- action buttons -->
        <div class="mt-4 flex">
          <Button
            class="flex-grow"
            on:click="{submit}"
            inProgress="{loading}"
            icon="{faFileImport}"
            disabled="{localModel === undefined}"
            aria-label="Import model">
            Import Models
          </Button>
        </div>
      </div>
    </div>
  </svelte:fragment>
</FormPage>
