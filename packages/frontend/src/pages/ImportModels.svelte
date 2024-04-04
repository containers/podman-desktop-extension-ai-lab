<script lang="ts">
import { faMinusCircle, faPlusCircle, faUpload } from '@fortawesome/free-solid-svg-icons';
import { router } from 'tinro';
import { studioClient } from '../utils/client';
import { Uri } from '@shared/src/uri/Uri';
import Button from '../lib/button/Button.svelte';
import ErrorMessage from '../lib/ErrorMessage.svelte';
import NavPage from '../lib/NavPage.svelte';
import type { LocalModelImportInfo } from '@shared/src/models/ILocalModelInfo';

let modelsToImport: LocalModelImportInfo[] = [];
let importError: string = '';
let addModelError: string = '';

let inProgress = false;

$: importDisabled = modelsToImport.length === 0;

async function addModelsToImport() {
  addModelError = '';
  try {
    const models = await studioClient.openDialog({
      title: 'Select models to import',
      selectors: ['multiSelections', 'openFile'],
      filters: [
        {
          name: 'GGUF files',
          extensions: ['gguf'],
        },
      ],
    });
    if (!models) {
      return;
    }
    const modelsInfo: LocalModelImportInfo[] = [];
    models.forEach(model => {
      model = Uri.revive(model);
      const modelPath = model.path;
      // we show an initial name that can be modified by the user.
      const lastSlashIndex = modelPath.replace(/\\/g, '/').lastIndexOf('/') + 1;

      if (!modelsToImport.find(i => i.path === modelPath)) {
        modelsInfo.push({
          path: modelPath,
          name: modelPath.substring(lastSlashIndex).replace('.gguf', ''),
        });
      }
    });
    const invalidModelsToImport = await studioClient.checkInvalidModels(modelsInfo.map(m => m.path));
    if (invalidModelsToImport.length > 0) {
      addModelError = `Error: the following ${invalidModelsToImport.length === 1 ? 'model is' : 'models are'} already in the catalog and cannot be imported: `;
      invalidModelsToImport.forEach(path => {
        addModelError += `${path} ; `;
      });
      modelsToImport = [...modelsToImport, ...modelsInfo.filter(m => !invalidModelsToImport.includes(m.path))];
    } else {
      modelsToImport = [...modelsToImport, ...modelsInfo];
    }
  } catch (e) {
    addModelError = `Error while adding models: ${String(e)}`;
  }
}

function onModelNameInput(event: Event, index: number) {
  const target = event.currentTarget as HTMLInputElement;
  modelsToImport[index].name = target.value;
  modelsToImport = modelsToImport;
}

function deleteModelToImport(index: number) {
  modelsToImport = modelsToImport.filter((_, i) => i !== index);
}

async function importModels() {
  importError = '';
  inProgress = true;

  try {
    await studioClient.importModels(modelsToImport);
  } catch (e) {
    importError = `Error while importing models: ${String(e)}\n`;
  }

  inProgress = false;
  if (importError === '') {
    router.goto(`/models`);
  }
}
</script>

<NavPage lastPage="{{ name: 'Models', path: '/models' }}" title="Import Models" searchEnabled="{false}">
  <svelte:fragment slot="content">
    <div class="p-5 min-w-full h-fit">
      <div class="bg-charcoal-800 rounded-lg px-6 py-6 space-y-2">
        <span class="block mb-2 text-sm font-medium text-gray-400">Models to import:</span>
        <Button on:click="{addModelsToImport}" icon="{faPlusCircle}" type="link" aria-label="Add models"
          >Add .GGUF Models</Button>
        <div aria-label="importError">
          {#if addModelError !== ''}
            <ErrorMessage class="py-2 text-sm" error="{addModelError}" />
          {/if}
        </div>
        <!-- Display the list of existing containersToImport -->
        {#if modelsToImport.length > 0}
          <div class="flex flex-row justify-center w-full py-1 text-sm font-medium text-gray-400">
            <div class="flex flex-col grow pl-2">Path</div>
            <div class="flex flex-col w-2/4 mr-2.5">Name</div>
          </div>
        {/if}
        {#each modelsToImport as modelToImport, index}
          <div class="flex flex-row w-full py-1">
            <div class="flex flex-col grow">
              <input
                class="flex flex-col grow p-2 outline-none text-sm bg-transparent rounded-sm text-gray-700 placeholder-gray-700 border-charcoal-100 border-b mr-2"
                bind:value="{modelToImport.path}"
                aria-label="model path"
                readonly="{true}" />
            </div>
            <div class="flex flex-col grow">
              <input
                bind:value="{modelToImport.name}"
                on:input="{event => onModelNameInput(event, index)}"
                aria-label="model importing name"
                placeholder="Model Name displayed"
                class="flex flex-col grow ml-2 p-1 outline-none text-sm bg-transparent rounded-sm text-gray-700 placeholder-gray-700 border-charcoal-100 border-b hover:border-purple-400 focus:border-purple-400 focus:border focus:rounded-lg focus:bg-charcoal-900" />
            </div>
            <Button type="link" on:click="{() => deleteModelToImport(index)}" icon="{faMinusCircle}" />
          </div>
        {/each}

        <div aria-label="importError">
          {#if importError !== ''}
            <ErrorMessage class="py-2 text-sm" error="{importError}" />
          {/if}
        </div>
        <Button
          on:click="{() => importModels()}"
          inProgress="{inProgress}"
          class="w-full"
          icon="{faUpload}"
          aria-label="Import models"
          bind:disabled="{importDisabled}">
          Import Models
        </Button>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
