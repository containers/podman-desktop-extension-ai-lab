<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import NavPage from '../lib/NavPage.svelte';
import Table from '../lib/table/Table.svelte';
import { Column, Row } from '../lib/table/table';
import { localModels } from '../stores/local-models';
import ModelColumnName from './ModelColumnName.svelte';
import ModelColumnRegistry from './ModelColumnRegistry.svelte';
import ModelColumnPopularity from './ModelColumnPopularity.svelte';
import ModelColumnLicense from './ModelColumnLicense.svelte';
import ModelColumnHw from './ModelColumnHW.svelte';
import { onDestroy, onMount } from 'svelte';
import { studioClient } from '/@/utils/client';
import type { Category } from '@shared/models/ICategory';
import type { Task } from '@shared/models/ITask';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';
import { faRefresh } from '@fortawesome/free-solid-svg-icons';
import Card from '/@/lib/Card.svelte';
import Button from '/@/lib/button/Button.svelte';
import LinearProgress from '/@/lib/progress/LinearProgress.svelte';

const columns: Column<ModelInfo>[] = [
  new Column<ModelInfo>('Name', { width: '4fr', renderer: ModelColumnName }),
  new Column<ModelInfo>('HW Compat', { width: '1fr', renderer: ModelColumnHw }),
  new Column<ModelInfo>('Registry', { width: '1fr', renderer: ModelColumnRegistry }),
  new Column<ModelInfo>('Popularity', { width: '1fr', renderer: ModelColumnPopularity }),
  new Column<ModelInfo>('License', { width: '1fr', renderer: ModelColumnLicense }),
];
const row = new Row<ModelInfo>({});

let loading: boolean = true;
let intervalId: ReturnType<typeof setInterval> | undefined = undefined;

let tasks: Task[] = [];
let models: ModelInfo[] = [];
let filteredModels: ModelInfo[] = [];

function filterModels(): void {
  // Let's collect the models we do not want to show (loading, error).
  const modelsId: string[] = tasks.reduce((previousValue, currentValue) => {
    if(currentValue.state === 'success')
      return previousValue;

    if(currentValue.labels !== undefined) {
      previousValue.push(currentValue.labels["model-pulling"]);
    }
    return previousValue;
  }, [] as string[]);
  filteredModels = models.filter((model) => !(model.id in modelsId));
}

onMount(() => {
  // Pulling update
  intervalId = setInterval(async () => {
    tasks = await studioClient.getTasksByLabel("model-pulling");
    loading = false;
    filterModels();
  }, 1000);

  // Subscribe to the models store
  return localModels.subscribe((value) => {
    models = value;
    filterModels();
  })
});

onDestroy(() => {
  if(intervalId !== undefined) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
});

</script>

<NavPage title="Models on disk" searchEnabled="{false}">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      {#if loading}
        <LinearProgress/>
      {/if}
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
            <div>There is no model yet</div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
</NavPage>
