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
  type LlamaStackContainerInfo,
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
let containerInfo: LlamaStackContainerInfo | undefined = $state(undefined);
// available means the container is started
let available: boolean = $derived(!!containerInfo);
// loading state
let loading = $derived(
  containerInfo === undefined &&
    filterByLabel($tasks, { trackingId: LLAMA_STACK_CONTAINER_TRACKINGID }).length > 0 &&
    !errorMsg,
);

onMount(async () => {
  containerInfo = await llamaStackClient.getLlamaStackContainerInfo();
});

$effect(() => {
  // Select default connection
  if (!containerProviderConnection && startedContainerProviderConnectionInfo.length > 0) {
    containerProviderConnection = startedContainerProviderConnectionInfo[0];
  }
});

function processTasks(trackedTasks: Task[]): void {
  // Check for errors
  // hint: we do not need to display them as the TasksProgress component will
  errorMsg = trackedTasks.find(task => task.error)?.error;

  const task: Task | undefined = trackedTasks.find(task => 'containerId' in (task.labels ?? {}));
  if (task === undefined) return;

  containerInfo =
    task.labels?.['containerId'] && task.labels?.['port']
      ? {
          containerId: task.labels?.['containerId'],
          port: parseInt(task.labels?.['port']),
        }
      : undefined;
}

// Submit method when the form is valid
async function submit(): Promise<void> {
  errorMsg = undefined;
  try {
    await llamaStackClient.requestCreateLlamaStackContainer({
      connection: $state.snapshot(containerProviderConnection),
    });
  } catch (err: unknown) {
    console.error('Something wrong while trying to create the Llama Stack container.', err);
    errorMsg = String(err);
  }
}

// Navigate to the new created service
function openLlamaStackContainer(): void {
  llamaStackClient.routeToLlamaStackContainerTerminal(containerInfo!.containerId).catch(console.error);
}

function openLink(url: string): void {
  studioClient.openURL(url).catch(err => console.error(`Error opening URL: ${url}`, err));
}
</script>

<FormPage title="Run Llama Stack as a container">
  <svelte:fragment slot="content">
    <div class="flex flex-col w-full">
      <header class="mx-5 mt-5">
        <div class="w-full flex flex-row">
          {#if available}
            <Button inProgress={!available} title="Open Llama Stack container" on:click={openLlamaStackContainer}>
              Open Llama Stack container
            </Button>
          {:else}
            <Button title="Start Llama Stack container" inProgress={loading} on:click={submit}>
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
      {#if startedContainerProviderConnectionInfo.length > 1 || containerInfo !== undefined || errorMsg !== undefined}
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

            {#if containerInfo !== undefined || errorMsg !== undefined}
              <h1 class="pt-4 mb-2 text-lg first-letter:uppercase">Instructions</h1>

              {#if containerInfo}
                <p>Llama Stack API is accessible at http://localhost:{containerInfo.port}</p>
                <p>
                  Access
                  <Tooltip tip="Open swagger documentation">
                    <Link
                      aria-label="swagger documentation"
                      on:click={openLink.bind(undefined, `http://localhost:${containerInfo.port}/docs`)}>
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
