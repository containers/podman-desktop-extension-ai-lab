<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import Button from '/@/lib/button/Button.svelte';
import Fa from 'svelte-fa';
import {
  faDownload,
  faFileImport, faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import Route from '/@/Route.svelte';
import Tooltip from '/@/lib/Tooltip.svelte';
import { studioClient } from '/@/utils/client';
import ErrorMessage from '/@/lib/ErrorMessage.svelte';
import { router } from 'tinro';
import { Uri } from '@shared/src/uri/Uri';
let loading: boolean;
$: loading = false;
let error: string | undefined = undefined;

// remote import
let repository: string = '';
let remoteConfigPath: string = '';

// local import
let localPath: string = ''

// Submit method when the form is valid
const importLocal = async () => {
  loading = true;
  error = undefined;
  studioClient.importLocalRecipe(localPath)
    .then(() => {
      router.goto('/recipes');
    }).catch((err: unknown) => {
    error = String(err);
  }).finally(() => {
    loading = false;
  });
};

const openFileDialog = (): void => {
  studioClient.openDialog({
    title: 'Select models to import',
    selectors: ['openFile'],
    filters: [
      {
        name: 'recipe config',
        extensions: ['yaml'],
      },
    ],
  }).then((result) => {
    if(!result || result.length === 0)
      return;

    localPath = Uri.revive(result[0]).path;
  });
}
</script>

<NavPage
  lastPage="{{ name: 'Recipes', path: '/recipes' }}"
  icon="{faFileImport}"
  title="Import Recipe"
  searchEnabled="{false}">
  <!-- Tabs
  <svelte:fragment slot="tabs">
    <Tab title="Local recipe" url="import" />
    <Tab title="Remote recipe" url="import/remote" />
  </svelte:fragment>
  -->

  <!-- content -->
  <svelte:fragment slot="content">
    <div class="flex flex-col w-full">

      <div aria-label="importError">
        {#if error !== undefined}
          <ErrorMessage class="py-2 text-sm" error="{error}" />
        {/if}
      </div>

      <!-- form -->
      <div class="bg-charcoal-800 m-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg h-fit">
        <div class="w-full">

          <!-- Local import -->
          <Route path="/">

            <!-- ai-lab file import input -->
            <label for="recipePath" class="pt-4 block mb-2 text-sm font-bold text-gray-400">Import <code>ai-lab.yaml</code> file</label>
            <div class="flex flex-row w-full py-1">
              <input
                class="flex flex-col grow p-2 outline-none text-sm bg-transparent rounded-sm text-gray-700 placeholder-gray-700 border-charcoal-100 border-b mr-2"
                bind:value="{localPath}"
                name="recipePath"
                aria-label="recipe path"
                readonly="{true}" />
              <Button type="link" on:click={openFileDialog} icon="{faFileImport}" />
            </div>

          </Route>

          <!-- Remote import -->
          <Route path="/remote">

            <!-- git input -->
            <label for="gitRepository" class="pt-4 block mb-2 text-sm font-bold text-gray-400">Git repository</label>
            <input
              type="text"
              bind:value="{repository}"
              class="w-full p-2 outline-none text-sm bg-charcoal-600 rounded-sm text-gray-700 placeholder-gray-700"
              placeholder="https://github.com/containers/ai-lab-recipes"
              name="gitRepository"
              aria-label="Git input"
              disabled="{loading}"
              required />

            <!-- git config path -->
            <div class="flex w-full items-center">
              <label for="remotePath" class="grow pt-4 block mb-2 text-sm font-bold text-gray-400">Config file path (optional)</label>
              <Tooltip tip="The config file path is the relative path to the ai-lab.yaml file in the repository. If not specify we will check at the root of the repository." left>
                <Fa icon="{faInfoCircle}"/>
              </Tooltip>
            </div>
            <input
              type="text"
              bind:value="{remoteConfigPath}"
              class="w-full p-2 outline-none text-sm bg-charcoal-600 rounded-sm text-gray-700 placeholder-gray-700"
              placeholder="ai-lab.yaml"
              name="remotePath"
              aria-label="Remote path input"
              disabled="{loading}" />
          </Route>


        </div>
        <footer>
          <div class="w-full flex flex-col">

            <!-- local action -->
            <Route path="/">
              <Button
                title="Import recipe"
                disabled="{localPath === ''}"
                on:click={importLocal}
                icon="{faFileImport}">
                Import local recipe
              </Button>
            </Route>

            <!-- remote action -->
            <Route path="/remote">
              <Button
                title="Import recipe"
                disabled="{repository === ''}"
                icon="{faDownload}">
                Clone repository
              </Button>
            </Route>

          </div>
        </footer>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
