<script lang="ts">
import { faExclamationCircle, faInfoCircle, faPlus, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { modelsInfo } from '/@/stores/modelsInfo';
import Fa from 'svelte-fa';
import { studioClient } from '../utils/client';
import { router } from 'tinro';
import { onDestroy, onMount } from 'svelte';
import type { Task } from '@shared/src/models/ITask';
import TasksProgress from '../lib/progress/TasksProgress.svelte';
import { tasks } from '../stores/tasks';
import { filterByLabel } from '../utils/taskUtils';
import type { Unsubscriber } from 'svelte/store';
import { Button, ErrorMessage, FormPage, Input } from '@podman-desktop/ui-svelte';

let localModels: ModelInfo[];
$: localModels = $modelsInfo.filter(model => model.file);
$: availModels = $modelsInfo.filter(model => !model.file);
let modelId: string | undefined = undefined;
let submitted: boolean = false;
let playgroundName: string;
let errorMsg: string | undefined = undefined;

// The tracking id is a unique identifier provided by the
// backend when calling requestCreateInferenceServer
let trackingId: string | undefined = undefined;

// The trackedTasks are the tasks linked to the trackingId
let trackedTasks: Task[] = [];

$: {
  if (!modelId && localModels.length > 0) {
    modelId = localModels[0].id;
  }
}

function openModelsPage() {
  router.goto(`/models`);
}

// Navigate to the new created playground environment
const openPlaygroundPage = (playgroundId: string) => {
  router.goto(`/playground/${playgroundId}`);
};

function onNameInput(event: Event) {
  playgroundName = (event.target as HTMLInputElement).value || '';
}

async function submit() {
  errorMsg = undefined;
  const model: ModelInfo | undefined = localModels.find(model => model.id === modelId);
  if (model === undefined) throw new Error('model id not valid.');
  // disable submit button
  submitted = true;
  try {
    // Using || and not && as we want to have the empty string systemPrompt passed as undefined
    trackingId = await studioClient.requestCreatePlayground(playgroundName, model);
  } catch (err: unknown) {
    trackingId = undefined;
    console.error('Something wrong while trying to create the playground.', err);
    errorMsg = String(err);
    submitted = false;
  }
}

// Utility method to filter the tasks properly based on the tracking Id
const processTasks = (tasks: Task[]) => {
  if (!trackingId) {
    trackedTasks = [];
    return;
  }

  trackedTasks = filterByLabel(tasks, {
    trackingId: trackingId,
  });

  // Check for errors
  // hint: we do not need to display them as the TasksProgress component will
  const error = trackedTasks.find(task => task.error)?.error !== undefined;
  if (error) {
    submitted = false;
  }

  const task: Task | undefined = trackedTasks.find(task => 'playgroundId' in (task.labels ?? {}));
  if (task === undefined) return;

  const playgroundId = task.labels?.['playgroundId'];
  if (playgroundId) {
    openPlaygroundPage(playgroundId);
  }
};

let unsubscribeTasks: Unsubscriber;
onMount(() => {
  unsubscribeTasks = tasks.subscribe(tasks => {
    processTasks(tasks);
  });
});

onDestroy(() => {
  unsubscribeTasks?.();
});

export function goToUpPage(): void {
  router.goto('/playgrounds');
}
</script>

<FormPage
  title="New Playground environment"
  breadcrumbLeftPart="Playgrounds"
  breadcrumbRightPart="New Playground environment"
  breadcrumbTitle="Go back to Playgrounds"
  on:close="{goToUpPage}"
  on:breadcrumbClick="{goToUpPage}">
  <svelte:fragment slot="icon">
    <div class="rounded-full w-8 h-8 flex items-center justify-center">
      <Fa size="1.125x" class="text-[var(--pd-content-header-icon)]" icon="{faPlus}" />
    </div>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex flex-col w-full">
      <!-- tasks tracked -->
      {#if trackedTasks.length > 0}
        <div class="mx-5 mt-5" role="status">
          <TasksProgress tasks="{trackedTasks}" />
        </div>
      {/if}

      <!-- form -->
      <div class="bg-[var(--pd-content-card-bg)] m-5 pt-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg h-fit">
        <div class="w-full">
          <!-- playground name input -->
          <label for="playgroundName" class="block mb-2 text-sm font-bold text-[var(--pd-content-card-header-text)]"
            >Playground name</label>
          <Input
            disabled="{submitted}"
            id="playgroundName"
            class="w-full"
            type="text"
            name="playgroundName"
            on:input="{onNameInput}"
            placeholder="Leave blank to generate a name"
            aria-label="playgroundName" />

          <!-- model input -->
          <label for="model" class="pt-4 block mb-2 text-sm font-bold text-[var(--pd-content-card-header-text)]"
            >Model</label>
          <select
            required
            disabled="{submitted}"
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
          {:else if availModels.length > 0}
            <div class="text-sm p-1 flex flex-row items-center text-[var(--pd-content-card-text)]">
              <Fa size="1.1x" class="cursor-pointer" icon="{faInfoCircle}" />
              <div role="alert" aria-label="Info Message Content" class="ml-2">
                Other models are available, but must be downloaded from the <a
                  href="{'javascript:void(0);'}"
                  class="underline"
                  title="Models page"
                  on:click="{openModelsPage}">models page</a
                >.
              </div>
            </div>
          {/if}
        </div>
        {#if errorMsg !== undefined}
          <ErrorMessage error="{errorMsg}" />
        {/if}
        <footer>
          <div class="w-full flex flex-col">
            <Button
              title="Create playground"
              inProgress="{submitted}"
              on:click="{submit}"
              disabled="{!modelId}"
              icon="{faPlusCircle}">
              Create playground
            </Button>
          </div>
        </footer>
      </div>
    </div>
  </svelte:fragment>
</FormPage>
