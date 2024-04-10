<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import Button from '/@/lib/button/Button.svelte';
import { faExclamationCircle, faLocationArrow, faPlus, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { modelsInfo } from '/@/stores/modelsInfo';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import Fa from 'svelte-fa';
import { router } from 'tinro';
import { onMount } from 'svelte';
import { studioClient } from '/@/utils/client';
import { tasks } from '/@/stores/tasks';
import type { Task } from '@shared/src/models/ITask';
import { filterByLabel } from '/@/utils/taskUtils';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';
import ErrorMessage from '../lib/ErrorMessage.svelte';
import { inferenceServers } from '/@/stores/inferenceServers';
import ContainerConnectionStatusInfo from '../lib/notification/ContainerConnectionStatusInfo.svelte';
import type { ContainerConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
import { checkContainerConnectionStatus } from '../utils/connectionUtils';

// List of the models available locally
let localModels: ModelInfo[];
$: localModels = $modelsInfo.filter(model => model.file);

// The containerPort is the bind value to form input
let containerPort: number | undefined = undefined;
// The modelId is the bind value to form input
let modelId: string | undefined = undefined;
// If the creation of a new inference service fail
let errorMsg: string | undefined = undefined;

// The tracking id is a unique identifier provided by the
// backend when calling requestCreateInferenceServer
let trackingId: string | undefined = undefined;
// The trackedTasks are the tasks linked to the trackingId
let trackedTasks: Task[];

// has an error been raised
let error: boolean = false;

// The containerId will be included in the tasks when the creation
// process will be completed
let containerId: string | undefined = undefined;
$: available = containerId && $inferenceServers.some(server => server.container.containerId);

let connectionInfo: ContainerConnectionInfo | undefined;
$: if (localModels && modelId) {
  checkContainerConnectionStatus(localModels, modelId)
    .then(value => (connectionInfo = value))
    .catch((e: unknown) => console.log(String(e)));
}

const onContainerPortInput = (event: Event): void => {
  const raw = (event.target as HTMLInputElement).value;
  try {
    containerPort = parseInt(raw);
  } catch (e: unknown) {
    console.warn('invalid value for container port', e);
    containerPort = 8888;
  }
};

// Submit method when the form is valid
const submit = async () => {
  errorMsg = undefined;
  const model: ModelInfo | undefined = localModels.find(model => model.id === modelId);
  if (model === undefined) throw new Error('model id not valid.');
  if (containerPort === undefined) throw new Error('invalid container port');

  try {
    error = false;
    trackingId = await studioClient.requestCreateInferenceServer({
      modelsInfo: [model],
      port: containerPort,
    });
  } catch (err: unknown) {
    trackingId = undefined;
    console.error('Something wrong while trying to create the inference server.', err);
    errorMsg = String(err);
  }
};

// Navigate to the list of models
const openModelsPage = () => {
  router.goto(`/models`);
};

// Navigate to the new created service
const openServiceDetails = () => {
  router.goto(`/service/${containerId}`);
};

// Utility method to filter the tasks properly based on the tracking Id
const processTasks = (tasks: Task[]) => {
  if (trackingId === undefined) {
    trackedTasks = [];
    return;
  }

  trackedTasks = filterByLabel(tasks, {
    trackingId: trackingId,
  });

  // Check for errors
  // hint: we do not need to display them as the TasksProgress component will
  error = trackedTasks.find(task => task.error)?.error !== undefined;

  const task: Task | undefined = trackedTasks.find(task => 'containerId' in (task.labels || {}));
  if (task === undefined) return;

  containerId = task.labels?.['containerId'];
};

onMount(async () => {
  containerPort = await studioClient.getHostFreePort();

  const queryModelId = router.location.query.get('model-id');
  if (queryModelId !== undefined && typeof queryModelId === 'string') {
    modelId = queryModelId;
  }

  tasks.subscribe(tasks => {
    processTasks(tasks);
  });
});
</script>

<NavPage
  lastPage="{{ name: 'Model Services', path: '/services' }}"
  icon="{faPlus}"
  title="Creating Model service"
  searchEnabled="{false}"
  loading="{containerPort === undefined}">
  <svelte:fragment slot="content">
    <div class="flex flex-col w-full">
      <!-- warning machine resources -->
      {#if connectionInfo}
        <div class="mx-5">
          <ContainerConnectionStatusInfo connectionInfo="{connectionInfo}" />
        </div>
      {/if}

      <!-- tasks tracked -->
      {#if trackedTasks?.length > 0}
        <div class="mx-5 mt-5" role="status">
          <TasksProgress tasks="{trackedTasks}" />
        </div>
      {/if}

      <!-- form -->
      <div class="bg-charcoal-800 m-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg h-fit">
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
        {#if errorMsg !== undefined}
          <ErrorMessage error="{errorMsg}" />
        {/if}
        <footer>
          <div class="w-full flex flex-col">
            {#if containerId === undefined}
              <Button
                title="Create service"
                inProgress="{trackingId !== undefined && !error}"
                on:click="{submit}"
                disabled="{!modelId}"
                icon="{faPlusCircle}">
                Create service
              </Button>
            {:else}
              <Button
                inProgress="{!available}"
                title="Open service details"
                on:click="{openServiceDetails}"
                icon="{faLocationArrow}">
                Open service details
              </Button>
            {/if}
          </div>
        </footer>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
