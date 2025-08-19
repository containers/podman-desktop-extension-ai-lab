<script lang="ts">
import { tasks } from '/@/stores/tasks';
import type { ContainerProviderConnectionInfo } from '@shared/models/IContainerConnectionInfo';
import { Button, ErrorMessage, FormPage, Link, Tooltip } from '@podman-desktop/ui-svelte';
import { containerProviderConnections } from '/@/stores/containerProviderConnections';
import ContainerProviderConnectionSelect from '/@/lib/select/ContainerProviderConnectionSelect.svelte';
import TrackedTasks from '/@/lib/progress/TrackedTasks.svelte';
import { llamaStackClient, studioClient } from '/@/utils/client';
import type { Task } from '@shared/models/ITask';
import { onMount } from 'svelte';
import { filterByLabel } from '/@/utils/taskUtils';
import {
  LLAMA_STACK_CONTAINER_TRACKINGID,
  type LlamaStackContainers,
} from '@shared/models/llama-stack/LlamaStackContainerInfo';

// The container provider connection to use
let containerProviderConnection: ContainerProviderConnectionInfo | undefined = $state(undefined);

// Filtered connections (started)
let startedContainerProviderConnectionInfo: ContainerProviderConnectionInfo[] = $derived(
  $containerProviderConnections.filter(connection => connection.status === 'started'),
);

// If the creation of the llama stack fail
let errorMsg: string | undefined = $state(undefined);
// The containerId will be included in the tasks when the creation
// process will be completed
let stack_containers = $state<LlamaStackContainers | undefined>(undefined);
// available means the container is started
let available: boolean = $derived(
  stack_containers?.server?.state === 'running' && stack_containers?.playground?.state === 'running',
);
let loading = $derived(
  stack_containers === undefined &&
    filterByLabel($tasks, { trackingId: LLAMA_STACK_CONTAINER_TRACKINGID }).length > 0 &&
    !errorMsg,
);

// Keep UI in "starting" state until tasks finish, even if containersInfo flips to ready
let hasActiveTasks = $derived(
  filterByLabel($tasks, { trackingId: LLAMA_STACK_CONTAINER_TRACKINGID }).some(t => t.state === 'loading'),
);
let uiReady = $derived(available && !hasActiveTasks);

onMount(async () => {
  stack_containers = await llamaStackClient.getLlamaStackContainersInfo();
  console.log('stack_containers', stack_containers);
  console.log('server', stack_containers?.server);
  console.log('playground', stack_containers?.playground);
});

$effect(() => {
  // Select default connection
  if (!containerProviderConnection && startedContainerProviderConnectionInfo.length > 0) {
    containerProviderConnection = startedContainerProviderConnectionInfo[0];
  }
});

function processTasks(trackedTasks: Task[]): void {
  // capture first error (if any)
  errorMsg = trackedTasks.find(task => task.error)?.error;

  // find the first task with all required labels
  const task = trackedTasks.find(
    t =>
      t.labels &&
      'containerId' in t.labels &&
      'port' in t.labels &&
      'state' in t.labels &&
      'playgroundId' in t.labels &&
      'playgroundPort' in t.labels &&
      'playgroundState' in t.labels,
  );
  if (!task) return;

  stack_containers = {
    server: {
      containerId: task.labels!['containerId'],
      port: parseInt(task.labels!['port']),
      state: task.labels!['state'],
    },
    playground: {
      containerId: task.labels!['playgroundId'],
      port: parseInt(task.labels!['playgroundPort']),
      state: task.labels!['playgroundState'],
    },
  };
}

// Submit method when the form is valid
async function submit(): Promise<void> {
  errorMsg = undefined;
  try {
    await llamaStackClient.requestcreateLlamaStackContainerss({
      connection: $state.snapshot(containerProviderConnection),
    });
  } catch (err: unknown) {
    console.error('Something wrong while trying to create the Llama Stack container.', err);
    errorMsg = String(err);
  }
}

// Navigate to the new created service
function openLlamaStackServerContainer(): void {
  llamaStackClient.routeToLlamaStackContainerTerminal(stack_containers!.server!.containerId!).catch(console.error);
}

function openLlamaStackPlaygroundContainer(): void {
  llamaStackClient.routeToLlamaStackContainerTerminal(stack_containers!.playground!.containerId!).catch(console.error);
}

function openLlamaStackPlayground(): void {
  openLink(`http://localhost:${stack_containers?.playground?.port}`);
}

function openLink(url: string): void {
  studioClient.openURL(url).catch(err => console.error(`Error opening URL: ${url}`, err));
}
</script>

<FormPage title="Run Llama Stack as a container">
  <svelte:fragment slot="content">
    <div class="flex flex-col w-full">
      <header class="mx-5 mt-5">
        <div class="w-full flex flex-row space-x-2">
          {#if uiReady}
            <Button
              inProgress={!uiReady}
              title="Open Llama Stack Server container"
              on:click={openLlamaStackServerContainer}>
              Open Llama Stack Server container
            </Button>
            <Button
              inProgress={!uiReady}
              title="Open Llama Stack Playground container"
              on:click={openLlamaStackPlaygroundContainer}>
              Open Llama Stack Playground container
            </Button>
            <Button
              disabled={!stack_containers?.playground?.port}
              inProgress={!uiReady}
              title="Explore LLama-Stack environment"
              on:click={openLlamaStackPlayground}>
              Explore LLama-Stack environment
            </Button>
          {:else}
            <Button title="Start Llama Stack container" inProgress={hasActiveTasks || loading} on:click={submit}>
              Start Llama Stack container
            </Button>
          {/if}
        </div>
      </header>
      <!-- tasks tracked -->
      <TrackedTasks
        class="mx-5 mt-5"
        onChange={processTasks}
        trackingId={LLAMA_STACK_CONTAINER_TRACKINGID}
        tasks={$tasks} />

      <!-- form -->
      {#if startedContainerProviderConnectionInfo.length > 1 || stack_containers !== undefined || errorMsg !== undefined}
        <div class="bg-[var(--pd-content-card-bg)] m-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg h-fit">
          <div class="w-full text-[var(--pd-details-body-text)]">
            <!-- container provider connection input -->
            {#if startedContainerProviderConnectionInfo.length > 1}
              <label for="" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
                >Container engine</label>
              <ContainerProviderConnectionSelect
                bind:value={containerProviderConnection}
                containerProviderConnections={startedContainerProviderConnectionInfo} />
            {/if}

            {#if stack_containers !== undefined || errorMsg !== undefined}
              <h1 class="pt-4 mb-2 text-lg first-letter:uppercase">Instructions</h1>

              {#if stack_containers}
                <p>Llama Stack API is accessible at http://localhost:{stack_containers.server?.port}</p>
                <p>
                  Access
                  <Tooltip tip="Open swagger documentation">
                    <Link
                      aria-label="swagger documentation"
                      on:click={openLink.bind(undefined, `http://localhost:${stack_containers.server?.port}/docs`)}>
                      swagger documentation
                    </Link>
                  </Tooltip>
                </p>
              {/if}
              {#if errorMsg !== undefined}
                <ErrorMessage error={errorMsg} />
              {/if}
            {/if}
          </div>
        </div>
      {/if}
    </div></svelte:fragment>
</FormPage>
