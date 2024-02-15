<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import NavPage from '../lib/NavPage.svelte';
import Table from '../lib/table/Table.svelte';
import { Column, Row } from '../lib/table/table';
import { modelsInfo } from '../stores/modelsInfo';
import ModelColumnName from '../lib/table/model/ModelColumnName.svelte';
import ModelColumnRegistry from '../lib/table/model/ModelColumnRegistry.svelte';
import ModelColumnPopularity from '../lib/table/model/ModelColumnPopularity.svelte';
import ModelColumnLicense from '../lib/table/model/ModelColumnLicense.svelte';
import ModelColumnHw from '../lib/table/model/ModelColumnHW.svelte';
import type { Task } from '@shared/src/models/ITask';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';
import Card from '/@/lib/Card.svelte';
import { onMount } from 'svelte';
import ModelColumnSize from '../lib/table/model/ModelColumnSize.svelte';
import ModelColumnCreation from '../lib/table/model/ModelColumnCreation.svelte';
import ModelColumnActions from '../lib/table/model/ModelColumnActions.svelte';
import Tab from '/@/lib/Tab.svelte';
import Route from '/@/Route.svelte';
import { tasks } from '/@/stores/tasks';

const columns: Column<ModelInfo>[] = [
  new Column<ModelInfo>('Name', { width: '3fr', renderer: ModelColumnName }),
  new Column<ModelInfo>('Size', { width: '1fr', renderer: ModelColumnSize }),
  new Column<ModelInfo>('Creation', { width: '1fr', renderer: ModelColumnCreation }),
  new Column<ModelInfo>('HW Compat', { width: '1fr', renderer: ModelColumnHw }),
  new Column<ModelInfo>('Registry', { width: '2fr', renderer: ModelColumnRegistry }),
  new Column<ModelInfo>('Popularity', { width: '1fr', renderer: ModelColumnPopularity }),
  new Column<ModelInfo>('License', { width: '2fr', renderer: ModelColumnLicense }),
  new Column<ModelInfo>('Actions', { align: 'right', width: '80px', renderer: ModelColumnActions }),
];
const row = new Row<ModelInfo>({});

let loading: boolean = true;

let pullingTasks: Task[] = [];
let models: ModelInfo[] = [];

// filtered mean, we remove the models that are being downloaded
let filteredModels: ModelInfo[] = [];

$: localModels = filteredModels.filter(model => model.file);
$: remoteModels = filteredModels.filter(model => !model.file);

function filterModels(): void {
  // Let's collect the models we do not want to show (loading, error).
  const modelsId: string[] = pullingTasks.reduce((previousValue, currentValue) => {
    if (currentValue.labels !== undefined) {
      previousValue.push(currentValue.labels['model-pulling']);
    }
    return previousValue;
  }, [] as string[]);
  filteredModels = models.filter(model => !modelsId.includes(model.id));
}

onMount(() => {
  // Subscribe to the tasks store
  const tasksUnsubscribe = tasks.subscribe(value => {
    pullingTasks = value.filter(task => task.state === 'loading');
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
</script>


<NavPage title="Models" searchEnabled="{false}" loading="{loading}">
  <svelte:fragment slot="tabs">
    <Tab title="All" url="models" />
    <Tab title="Downloaded" url="models/downloaded" />
    <Tab title="Available" url="models/available" />
  </svelte:fragment>

  <svelte:fragment slot="content">

    <div slot="content" class="flex flex-col min-w-full min-h-full">
      <div class="min-w-full min-h-full flex-1">
        <div class="mt-4 px-5 space-y-5 h-full">
          {#if !loading}
            {#if pullingTasks.length > 0}
              <div class="mx-4">
                <Card classes="bg-charcoal-800 mt-4">
                  <div slot="content" class="text-base font-normal p-2">
                    <div class="text-base mb-2">Downloading models</div>
                    <TasksProgress tasks="{pullingTasks}" />
                  </div>
                </Card>
              </div>
            {/if}

            <!-- All models -->
            <Route path="/" breadcrumb="All">
              {#if filteredModels.length > 0}
                <Table kind="model" data={filteredModels} columns="{columns}" row="{row}"></Table>
              {:else}
                <div role="status">There is no model yet</div>
              {/if}
            </Route>

            <!-- Downloaded models -->
            <Route path="/downloaded" breadcrumb="Downloaded">
              {#if localModels.length > 0}
                <Table kind="model" data={localModels} columns="{columns}" row="{row}"></Table>
              {:else}
                <div role="status">There is no model yet</div>
              {/if}
            </Route>

            <!-- Available models (from catalogs)-->
            <Route path="/available" breadcrumb="Available">
              {#if remoteModels.length > 0}
                <Table kind="model" data={remoteModels} columns="{columns}" row="{row}"></Table>
              {:else}
                <div role="status">There is no model yet</div>
              {/if}
            </Route>
          {/if}
        </div>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
