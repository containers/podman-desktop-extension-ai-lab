<script lang="ts">
import { router } from 'tinro';
import { tasks } from '/@/stores/tasks';
import type { ContainerProviderConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
import { Button, ErrorMessage, FormPage } from '@podman-desktop/ui-svelte';
import { containerProviderConnections } from '/@/stores/containerProviderConnections';
import ContainerProviderConnectionSelect from '/@/lib/select/ContainerProviderConnectionSelect.svelte';
import TrackedTasks from '/@/lib/progress/TrackedTasks.svelte';
import { instructlabClient } from '/@/utils/client';
import type { Task } from '@shared/src/models/ITask';
import { onMount } from 'svelte';

interface Props {
  // The tracking id is a unique identifier provided by the
  // backend when calling requestCreateInstrcutLabContainer
  trackingId?: string;
}

let { trackingId }: Props = $props();

// The container provider connection to use
let containerProviderConnection: ContainerProviderConnectionInfo | undefined = $state(undefined);

// Filtered connections (started)
let startedContainerProviderConnectionInfo: ContainerProviderConnectionInfo[] = $derived(
  $containerProviderConnections.filter(connection => connection.status === 'started'),
);

// If the creation of the InstructLab fail
let errorMsg: string | undefined = $state(undefined);
// The containerId will be included in the tasks when the creation
// process will be completed
let containerId: string | undefined = $state(undefined);
// available means the container is started
let available: boolean = $derived(!!containerId);
// loading state
let loading = $derived(trackingId !== undefined && !errorMsg);

onMount(async () => {
  containerId = await instructlabClient.getInstructlabContainerId();
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

  containerId = task.labels?.['containerId'];
}

// Submit method when the form is valid
async function submit(): Promise<void> {
  errorMsg = undefined;
  try {
    trackingId = await instructlabClient.requestCreateInstructlabContainer({
      connection: $state.snapshot(containerProviderConnection),
    });
    router.location.query.set('trackingId', trackingId);
  } catch (err: unknown) {
    console.error('Something wrong while trying to create the InstructLab container.', err);
    errorMsg = String(err);
  }
}

// Navigate to the new created service
function openInstructLabContainer(): void {
  instructlabClient.routeToInstructLabContainerTerminal(containerId!).catch(console.error);
}
</script>

<FormPage title="Run InstructLab as a container">
  <svelte:fragment slot="content">
    <div class="flex flex-col w-full">
      <header>
        <div class="w-full flex flex-row px-8">
          {#if available}
            <Button inProgress={!available} title="Open InstructLab container" on:click={openInstructLabContainer}>
              Open InstructLab container
            </Button>
          {:else}
            <Button title="Start InstructLab container" inProgress={loading} on:click={submit}>
              Start InstructLab container
            </Button>
          {/if}
          <Button title="Read documentation" type="link" on:click={submit}>Read documentation</Button>
        </div>
      </header>
      <!-- tasks tracked -->
      <TrackedTasks class="mx-5 mt-5" onChange={processTasks} trackingId={trackingId} tasks={$tasks} />

      <!-- form -->
      <div class="bg-[var(--pd-content-card-bg)] m-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg h-fit">
        <div class="w-full">
          <!-- container provider connection input -->
          {#if startedContainerProviderConnectionInfo.length > 1}
            <label for="" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
              >Container engine</label>
            <ContainerProviderConnectionSelect
              bind:value={containerProviderConnection}
              containerProviderConnections={startedContainerProviderConnectionInfo} />
          {/if}

          <h1 class="pt-4 mb-2 text-lg first-letter:uppercase">Instructions</h1>

          <h2 class="pt-4 mb-2">Create InstructLab configuration</h2>

          <code class="pt-4 mb-2 block">ilab config init</code>

          <h2 class="pt-4 mb-2">Download model</h2>

          <code class="pt-4 mb-2 block">ilab model download</code>

          <h2 class="pt-4 mb-2">Serve the model</h2>

          <code class="pt-4 mb-2 block">ilab model serve</code>

          <h2 class="pt-4 mb-2">Chat with the model</h2>

          <code class="pt-4 mb-2 block">ilab model chat</code>

          {#if errorMsg !== undefined}
            <ErrorMessage error={errorMsg} />
          {/if}
        </div>
      </div>
    </div></svelte:fragment>
</FormPage>
