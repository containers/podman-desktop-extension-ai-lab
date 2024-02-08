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
import { modelsPulling } from '../stores/recipe';
import { onMount } from 'svelte';
import ModelColumnSize from '../lib/table/model/ModelColumnSize.svelte';
import ModelColumnCreation from '../lib/table/model/ModelColumnCreation.svelte';
import ModelColumnActions from '../lib/table/model/ModelColumnActions.svelte';

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

let tasks: Task[] = [];
let models: ModelInfo[] = [];
let filteredModels: ModelInfo[] = [];

function filterModels(): void {
  // Let's collect the models we do not want to show (loading, error).
  const modelsId: string[] = tasks.reduce((previousValue, currentValue) => {
    if(currentValue.labels !== undefined) {
      previousValue.push(currentValue.labels["model-pulling"]);
    }
    return previousValue;
  }, [] as string[]);
  filteredModels = models.filter((model) => !modelsId.includes(model.id));
}

onMount(() => {
  // Pulling update
  const modelsPullingUnsubscribe = modelsPulling.subscribe(runningTasks => {
    // Only display error | loading tasks.
    tasks = runningTasks.filter((task) => task.state !== 'success');
    loading = false;
    filterModels();
  });

  // Subscribe to the models store
  const localModelsUnsubscribe = modelsInfo.subscribe((value) => {
    models = value;
    filterModels();
  })

  return () => {
    modelsPullingUnsubscribe();
    localModelsUnsubscribe();
  }
});
</script>

<NavPage title="Models" searchEnabled="{false}" loading="{loading}">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="mt-4 px-5 space-y-5 h-full">
        {#if !loading}
          {#if tasks.length > 0}
            <div class="mx-4">
              <Card classes="bg-charcoal-800 mt-4">
                <div slot="content" class="text-base font-normal p-2">
                  <div class="text-base mb-2">Downloading models</div>
                  <TasksProgress tasks="{tasks}"/>
                </div>
              </Card>
            </div>
          {/if}
          {#if filteredModels.length > 0}
            <Table
              kind="model"
              data="{filteredModels}"
              columns="{columns}"
              row={row}>
            </Table>
          {:else}
            <div role="status">There is no model yet</div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
</NavPage>
