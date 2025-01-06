<script lang="ts">
import { faFolder, faRocket, faUpRightFromSquare, faWarning } from '@fortawesome/free-solid-svg-icons';
import { catalog } from '/@/stores/catalog';
import Fa from 'svelte-fa';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import { findLocalRepositoryByRecipeId } from '/@/utils/localRepositoriesUtils';
import { localRepositories } from '/@/stores/localRepositories';
import { modelsInfo } from '/@/stores/modelsInfo';
import { Button, ErrorMessage, FormPage } from '@podman-desktop/ui-svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { InferenceType } from '@shared/src/models/IInference';
import { studioClient } from '/@/utils/client';
import type { Task } from '@shared/src/models/ITask';
import { tasks } from '/@/stores/tasks';
import { router } from 'tinro';
import type { ContainerProviderConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
import { containerProviderConnections } from '/@/stores/containerProviderConnections';
import ModelSelect from '/@/lib/select/ModelSelect.svelte';
import ContainerProviderConnectionSelect from '/@/lib/select/ContainerProviderConnectionSelect.svelte';
import ContainerConnectionWrapper from '/@/lib/notification/ContainerConnectionWrapper.svelte';
import TrackedTasks from '/@/lib/progress/TrackedTasks.svelte';

interface Props {
  recipeId: string;
  // The tracking id is a unique identifier provided by the
  // backend when calling requestPullApplication
  trackingId?: string;
}

let { recipeId, trackingId }: Props = $props();

let recipe: Recipe | undefined = $derived($catalog.recipes.find(r => r.id === recipeId));

// The container provider connection to use
let containerProviderConnection: ContainerProviderConnectionInfo | undefined = $state(undefined);
// Filtered connections (started)
let startedContainerProviderConnectionInfo: ContainerProviderConnectionInfo[] = $derived(
  $containerProviderConnections.filter(connection => connection.status === 'started'),
);
// recipe local path
let localPath: LocalRepository | undefined = $derived(findLocalRepositoryByRecipeId($localRepositories, recipe?.id));
// Filter all models based on backend property
let models: ModelInfo[] = $derived(
  $modelsInfo.filter(model => (model.backend ?? InferenceType.NONE) === (recipe?.backend ?? InferenceType.NONE)),
);
// Hold the selected model
let model: ModelInfo | undefined = $state(undefined);
// loading state
let loading = $state(false);
// All tasks are successful (not any in error)
let completed: boolean = $state(false);

let errorMsg: string | undefined = $state(undefined);

$effect(() => {
  // Select default connection
  if (!containerProviderConnection && startedContainerProviderConnectionInfo.length > 0) {
    containerProviderConnection = startedContainerProviderConnectionInfo[0];
  }
  // Select default model
  if (!model && recipe && models.length > 0) {
    model = getFirstRecommended();
  }

  // if no container provider connection found this is an error
  if (!containerProviderConnection) {
    errorMsg = 'No running container engine found';
  }
});

const getFirstRecommended = (): ModelInfo | undefined => {
  if (!recipe || !models) return undefined;
  const recommended = recipe.recommended && recipe.recommended.length > 0 ? recipe.recommended[0] : undefined;

  const model = models.find(model => model.id === recommended);
  if (!model) return undefined;
  return model;
};

const processTasks = (trackedTasks: Task[]): void => {
  // if one task is in loading we are still loading
  loading = !!trackingId && trackedTasks.some(task => task.state === 'loading');

  // if all task are successful we are successful
  completed = !!trackingId && trackedTasks.every(task => task.state === 'success');

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

  const nModel = models.find(model => model.id === modelId);
  if (!nModel) return;

  model = nModel;
}

async function submit(): Promise<void> {
  if (!recipe || !model) return;

  errorMsg = undefined;

  try {
    const trackingId = await studioClient.requestPullApplication({
      recipeId: $state.snapshot(recipe.id),
      modelId: $state.snapshot(model.id),
      connection: $state.snapshot(containerProviderConnection),
    });
    router.location.query.set('trackingId', trackingId);
  } catch (err: unknown) {
    console.error('Something wrong while trying to create the inference server.', err);
    errorMsg = String(err);
  }
}

export function goToUpPage(): void {
  router.goto('/recipes');
}

function handleOnClick(): void {
  router.goto(`/recipe/${recipeId}/running`);
}
</script>

<FormPage
  breadcrumbLeftPart="Recipes"
  breadcrumbRightPart="Start recipe"
  breadcrumbTitle="Go back to recipes page"
  title="Start recipe"
  onclose={goToUpPage}
  onbreadcrumbClick={goToUpPage}>
  <svelte:fragment slot="icon">
    <div class="rounded-full w-8 h-8 flex items-center justify-center">
      <Fa size="1.125x" class="text-[var(--pd-content-header-icon)]" icon={faRocket} />
    </div>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex flex-col w-full">
      <!-- warning machine resources -->
      {#if containerProviderConnection}
        <div class="mx-5">
          <ContainerConnectionWrapper
            checkContext="recipe"
            model={$state.snapshot(model)}
            containerProviderConnection={$state.snapshot(containerProviderConnection)} />
        </div>
      {/if}

      <!-- tasks tracked -->
      <TrackedTasks onChange={processTasks} class="mx-5 mt-5" trackingId={trackingId} tasks={$tasks} />

      {#if recipe}
        <!-- form -->
        <div class="space-y-6 bg-[var(--pd-content-card-bg)] m-5 px-8 sm:pb-6 xl:pb-8 rounded-lg h-fit">
          <div>
            <!-- selected recipe -->
            <label for="recipe" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
              >Recipe</label>

            <div
              class="py-2 px-4 rounded-lg w-full flex flex-col bg-[var(--pd-content-bg)] text-[var(--pd-content-card-text)]">
              <span aria-label="Recipe name">{recipe.name}</span>
              {#if localPath}
                <div
                  class="bg-[var(--pd-label-bg)] text-[var(--pd-label-text)] max-w-full rounded-md p-2 mb-2 flex flex-row w-full h-min text-sm text-nowrap items-center">
                  <Fa class="mr-2" icon={faFolder} />
                  <span aria-label="Recipe local path" class="overflow-x-hidden text-ellipsis max-w-full">
                    {localPath.path}
                  </span>
                </div>
              {/if}
            </div>

            <!-- container provider connection input -->
            {#if startedContainerProviderConnectionInfo.length > 1}
              <label for="model" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
                >Container engine</label>
              <ContainerProviderConnectionSelect
                bind:value={containerProviderConnection}
                containerProviderConnections={startedContainerProviderConnectionInfo} />
            {/if}

            <!-- model form -->
            <label for="select-model" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
              >Model</label>
            <ModelSelect bind:value={model} disabled={loading} recommended={recipe.recommended} models={models} />
            {#if model && model.file === undefined}
              <div class="text-gray-800 text-sm flex items-center">
                <Fa class="mr-2" icon={faWarning} />
                <span role="alert"
                  >The selected model will be downloaded. This action can take some time depending on your connection</span>
              </div>
            {/if}
          </div>

          {#if errorMsg !== undefined}
            <ErrorMessage error={errorMsg} />
          {/if}
          <footer>
            <div class="w-full flex flex-col">
              {#if completed}
                <Button icon={faUpRightFromSquare} title="Open details" on:click={handleOnClick}>Open details</Button>
              {:else}
                <Button
                  title="Start {recipe.name} recipe"
                  inProgress={loading}
                  on:click={submit}
                  disabled={!model || loading || !containerProviderConnection}
                  icon={faRocket}>
                  Start {recipe.name} recipe
                </Button>
              {/if}
            </div>
          </footer>
        </div>
      {/if}
    </div>
  </svelte:fragment>
</FormPage>
