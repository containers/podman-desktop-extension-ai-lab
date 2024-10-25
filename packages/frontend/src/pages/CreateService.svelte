<script lang="ts">
import { faExclamationCircle, faLocationArrow, faPlus, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { modelsInfo } from '/@/stores/modelsInfo';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import Fa from 'svelte-fa';
import { router } from 'tinro';
import { onMount } from 'svelte';
import { studioClient } from '/@/utils/client';
import { tasks } from '/@/stores/tasks';
import type { Task } from '@shared/src/models/ITask';
import { inferenceServers } from '/@/stores/inferenceServers';
import type { ContainerProviderConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
import { Button, ErrorMessage, FormPage, Input } from '@podman-desktop/ui-svelte';
import ModelSelect from '../lib/select/ModelSelect.svelte';
import { containerProviderConnections } from '/@/stores/containerProviderConnections';
import ContainerProviderConnectionSelect from '/@/lib/select/ContainerProviderConnectionSelect.svelte';
import ContainerConnectionWrapper from '/@/lib/notification/ContainerConnectionWrapper.svelte';
import TrackedTasks from '/@/lib/progress/TrackedTasks.svelte';

interface Props {
  // The tracking id is a unique identifier provided by the
  // backend when calling requestCreateInferenceServer
  trackingId?: string;
}

let { trackingId }: Props = $props();

// List of the models available locally
let localModels: ModelInfo[] = $derived($modelsInfo.filter(model => model.file));

// The container provider connection to use
let containerProviderConnection: ContainerProviderConnectionInfo | undefined = $state(undefined);

// Filtered connections (started)
let startedContainerProviderConnectionInfo: ContainerProviderConnectionInfo[] = $derived(
  $containerProviderConnections.filter(connection => connection.status === 'started'),
);

// The containerPort is the bind value to form input
let containerPort: number | undefined = $state(undefined);
// The model is the bind value to ModelSelect form
let model: ModelInfo | undefined = $state(undefined);
// If the creation of a new inference service fail
let errorMsg: string | undefined = $state(undefined);
// The containerId will be included in the tasks when the creation
// process will be completed
let containerId: string | undefined = $state(undefined);
// available means the server is started
let available: boolean = $derived(!!containerId && $inferenceServers.some(server => server.container.containerId));
// loading state
let loading = $derived(trackingId !== undefined && !errorMsg);

$effect(() => {
  // Select default model
  if (!model && localModels.length > 0) {
    model = localModels[0];
  }

  // Select default connection
  if (!containerProviderConnection && startedContainerProviderConnectionInfo.length > 0) {
    containerProviderConnection = startedContainerProviderConnectionInfo[0];
  }
});

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
const submit = async (): Promise<void> => {
  errorMsg = undefined;
  if (model === undefined) throw new Error('model id not valid.');
  if (containerPort === undefined) throw new Error('invalid container port');

  try {
    const trackingId = await studioClient.requestCreateInferenceServer({
      modelsInfo: [$state.snapshot(model)],
      port: $state.snapshot(containerPort),
      connection: $state.snapshot(containerProviderConnection),
    });
    router.location.query.set('trackingId', trackingId);
  } catch (err: unknown) {
    console.error('Something wrong while trying to create the inference server.', err);
    errorMsg = String(err);
  }
};

// Navigate to the list of models
const openModelsPage = (): void => {
  router.goto(`/models`);
};

// Navigate to the new created service
const openServiceDetails = (): void => {
  router.goto(`/service/${containerId}`);
};

// Utility method to filter the tasks properly based on the tracking Id
const processTasks = (trackedTasks: Task[]): void => {
  // Check for errors
  // hint: we do not need to display them as the TasksProgress component will
  errorMsg = trackedTasks.find(task => task.error)?.error;

  const task: Task | undefined = trackedTasks.find(task => 'containerId' in (task.labels ?? {}));
  if (task === undefined) return;

  containerId = task.labels?.['containerId'];

  // if we re-open the page, we might need to restore the model selected
  populateModelFromTasks(trackedTasks);
};

// This method uses the trackedTasks to restore the selected value of model
// It is useful when the page has been restored
function populateModelFromTasks(trackedTasks: Task[]): void {
  const task = trackedTasks.find(
    task => task.labels && 'model-id' in task.labels && typeof task.labels['model-id'] === 'string',
  );
  const modelId = task?.labels?.['model-id'];
  if (!modelId) return;

  const mModel = localModels.find(model => model.id === modelId);
  if (!mModel) return;

  model = mModel;
}

onMount(() => {
  studioClient
    .getHostFreePort()
    .then(port => {
      containerPort = port;
    })
    .catch((err: unknown) => {
      console.error(err);
    });

  // we might have a query parameter, then we should use it
  const queryModelId = router.location.query.get('model-id');
  if (queryModelId !== undefined && typeof queryModelId === 'string') {
    model = localModels.find(mModel => mModel.id === queryModelId);
  }
});

export function goToUpPage(): void {
  router.goto('/services');
}
</script>

<FormPage
  title="Creating Model service"
  breadcrumbLeftPart="Model Services"
  breadcrumbRightPart="Creating Model service"
  breadcrumbTitle="Go back to Model Services"
  onclose={goToUpPage}
  onbreadcrumbClick={goToUpPage}>
  <svelte:fragment slot="icon">
    <div class="rounded-full w-8 h-8 flex items-center justify-center">
      <Fa size="1.125x" class="text-[var(--pd-content-header-icon)]" icon={faPlus} />
    </div>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex flex-col w-full">
      <!-- warning machine resources -->
      {#if containerProviderConnection}
        <div class="mx-5">
          <ContainerConnectionWrapper
            model={$state.snapshot(model)}
            containerProviderConnection={$state.snapshot(containerProviderConnection)} />
        </div>
      {/if}

      <!-- tasks tracked -->
      <TrackedTasks onChange={processTasks} class="mx-5 mt-5" trackingId={trackingId} tasks={$tasks} />

      <!-- form -->
      <div class="bg-[var(--pd-content-card-bg)] m-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg h-fit">
        <div class="w-full">
          <!-- container provider connection input -->
          {#if startedContainerProviderConnectionInfo.length > 1}
            <label for="model" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
              >Container engine</label>
            <ContainerProviderConnectionSelect
              bind:value={containerProviderConnection}
              containerProviderConnections={startedContainerProviderConnectionInfo} />
          {/if}

          <!-- model input -->
          <label for="model" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]">Model</label>
          <ModelSelect models={localModels} disabled={loading} bind:value={model} />
          {#if localModels.length === 0}
            <div class="text-red-500 p-1 flex flex-row items-center">
              <Fa size="1.1x" class="cursor-pointer text-red-500" icon={faExclamationCircle} />
              <div role="alert" aria-label="Error Message Content" class="ml-2">
                You don't have any models downloaded. You can download them in <a
                  href={'javascript:void(0);'}
                  class="underline"
                  title="Models page"
                  on:click={openModelsPage}>models page</a
                >.
              </div>
            </div>
          {/if}
          <!-- container port input -->
          <label for="containerPort" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
            >Container port</label>
          <Input
            type="number"
            value={String(containerPort ?? 0)}
            on:input={onContainerPortInput}
            class="w-full"
            placeholder="8888"
            name="containerPort"
            aria-label="Port input"
            disabled={loading}
            required />
        </div>
        {#if errorMsg !== undefined}
          <ErrorMessage error={errorMsg} />
        {/if}
        <footer>
          <div class="w-full flex flex-col">
            {#if containerId === undefined}
              <Button
                title="Create service"
                inProgress={loading}
                on:click={submit}
                disabled={!model || !containerPort}
                icon={faPlusCircle}>
                Create service
              </Button>
            {:else}
              <Button
                inProgress={!available}
                title="Open service details"
                on:click={openServiceDetails}
                icon={faLocationArrow}>
                Open service details
              </Button>
            {/if}
          </div>
        </footer>
      </div>
    </div>
  </svelte:fragment>
</FormPage>
