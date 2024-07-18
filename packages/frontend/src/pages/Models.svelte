<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { modelsInfo } from '../stores/modelsInfo';
import ModelColumnName from '../lib/table/model/ModelColumnName.svelte';
import ModelColumnLabels from '../lib/table/model/ModelColumnLabels.svelte';
import type { Task } from '@shared/src/models/ITask';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';
import Card from '/@/lib/Card.svelte';
import { onMount } from 'svelte';
import ModelColumnSize from '../lib/table/model/ModelColumnSize.svelte';
import ModelColumnAge from '../lib/table/model/ModelColumnAge.svelte';
import ModelColumnActions from '../lib/table/model/ModelColumnActions.svelte';
import { Tab } from '@podman-desktop/ui-svelte';
import Route from '/@/Route.svelte';
import { tasks } from '/@/stores/tasks';
import ModelColumnIcon from '../lib/table/model/ModelColumnIcon.svelte';
import { router } from 'tinro';
import { Button } from '@podman-desktop/ui-svelte';
import { faFileImport } from '@fortawesome/free-solid-svg-icons';
import { Table, TableColumn, TableRow, NavPage } from '@podman-desktop/ui-svelte';

const columns: TableColumn<ModelInfo>[] = [
  new TableColumn<ModelInfo>('', { width: '40px', renderer: ModelColumnIcon }),
  new TableColumn<ModelInfo>('Name', {
    width: '3fr',
    renderer: ModelColumnName,
    comparator: (a, b) => b.name.localeCompare(a.name),
  }),
  new TableColumn<ModelInfo>('Size', {
    width: '50px',
    renderer: ModelColumnSize,
    comparator: (a, b) => (a.file?.size ?? 0) - (b.file?.size ?? 0),
  }),
  new TableColumn<ModelInfo>('Age', {
    width: '70px',
    renderer: ModelColumnAge,
    comparator: (a, b) => (a.file?.creation?.getTime() ?? 0) - (b.file?.creation?.getTime() ?? 0),
  }),
  new TableColumn<ModelInfo>('', { width: '225px', align: 'right', renderer: ModelColumnLabels }),
  new TableColumn<ModelInfo>('Actions', { align: 'right', width: '120px', renderer: ModelColumnActions }),
];
const row = new TableRow<ModelInfo>({});

let loading: boolean = true;

let pullingTasks: Task[] = [];
let models: ModelInfo[] = [];

// filtered mean, we remove the models that are being downloaded
let filteredModels: ModelInfo[] = [];

$: localModels = filteredModels.filter(model => model.file && model.url);
$: remoteModels = filteredModels.filter(model => !model.file);
$: importedModels = filteredModels.filter(model => !model.url);

function filterModels(): void {
  // Let's collect the models we do not want to show (loading).
  const modelsId: string[] = pullingTasks.reduce((previousValue, currentValue) => {
    if (currentValue.labels !== undefined && currentValue.state !== 'error') {
      previousValue.push(currentValue.labels['model-pulling']);
    }
    return previousValue;
  }, [] as string[]);
  filteredModels = models.filter(model => !modelsId.includes(model.id));
}

onMount(() => {
  // Subscribe to the tasks store
  const tasksUnsubscribe = tasks.subscribe(value => {
    // Filter out duplicates
    const modelIds = new Set<string>();
    pullingTasks = value.reduce((filtered: Task[], task: Task) => {
      if (
        (task.state === 'loading' || task.state === 'error') &&
        task.labels !== undefined &&
        'model-pulling' in task.labels &&
        !modelIds.has(task.labels['model-pulling'])
      ) {
        modelIds.add(task.labels['model-pulling']);
        filtered.push(task);
      }
      return filtered;
    }, []);

    loading = false;
    filterModels();
  });

  // Subscribe to the models store
  const localModelsUnsubscribe = modelsInfo.subscribe(value => {
    models = value;
    filterModels();
  });

  return () => {
    tasksUnsubscribe();
    localModelsUnsubscribe();
  };
});

async function importModel() {
  router.goto('/models/import');
}
</script>

<NavPage title="Models" searchEnabled={false}>
  <svelte:fragment slot="tabs">
    <Tab title="All" url="/models" selected={$router.path === '/models'} />
    <Tab title="Downloaded" url="/models/downloaded" selected={$router.path === '/models/downloaded'} />
    <Tab title="Imported" url="/models/imported" selected={$router.path === '/models/imported'} />
    <Tab title="Available" url="/models/available" selected={$router.path === '/models/available'} />
  </svelte:fragment>
  <svelte:fragment slot="additional-actions">
    <Button on:click={importModel} icon={faFileImport} aria-label="Import Models">Import</Button>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex flex-col min-w-full min-h-full">
      <div class="min-w-full min-h-full flex-1">
        <div class="mt-4 px-5 space-y-5">
          {#if !loading}
            {#if pullingTasks.length > 0}
              <Card classes="bg-charcoal-800 mt-4">
                <div slot="content" class="text-base font-normal p-2 w-full">
                  <div class="text-base mb-2">Downloading models</div>
                  <TasksProgress tasks={pullingTasks} />
                </div>
              </Card>
            {/if}

            <!-- All models -->
            <Route path="/">
              {#if filteredModels.length > 0}
                <Table kind="model" data={filteredModels} columns={columns} row={row}></Table>
              {:else}
                <div role="status" class="text-[var(--pd-content-text)]">There are no models yet</div>
              {/if}
            </Route>

            <!-- Downloaded models -->
            <Route path="/downloaded">
              {#if localModels.length > 0}
                <Table kind="model" data={localModels} columns={columns} row={row}></Table>
              {:else}
                <div role="status" class="text-[var(--pd-content-text)]">There are no models yet</div>
              {/if}
            </Route>

            <!-- Imported models -->
            <Route path="/imported">
              {#if importedModels.length > 0}
                <Table kind="model" data={importedModels} columns={columns} row={row}></Table>
              {:else}
                <div role="status" class="text-[var(--pd-content-text)]">There are no models yet</div>
              {/if}
            </Route>

            <!-- Available models (from catalogs)-->
            <Route path="/available">
              {#if remoteModels.length > 0}
                <Table kind="model" data={remoteModels} columns={columns} row={row}></Table>
              {:else}
                <div role="status" class="text-[var(--pd-content-text)]">There are no models yet</div>
              {/if}
            </Route>
          {/if}
        </div>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
