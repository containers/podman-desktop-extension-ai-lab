<script lang="ts">
import type { ModelInfo } from '@shared/models/IModelInfo';
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

const columns: Column<ModelInfo>[] = [
  new Column<ModelInfo>('Name', { width: '4fr', renderer: ModelColumnName }),
  new Column<ModelInfo>('HW Compat', { width: '1fr', renderer: ModelColumnHw }),
  new Column<ModelInfo>('Registry', { width: '1fr', renderer: ModelColumnRegistry }),
  new Column<ModelInfo>('Popularity', { width: '1fr', renderer: ModelColumnPopularity }),
  new Column<ModelInfo>('License', { width: '1fr', renderer: ModelColumnLicense }),
];
const row = new Row<ModelInfo>({});

let intervalId: ReturnType<typeof setInterval> | undefined = undefined;

$: tasks = [] as Task[];
$: models = [] as ModelInfo[];

function filterModels(tasks: Task[], models: ModelInfo[]): void {
  const dict: {[id: number]: Task} = Object.fromEntries(tasks.map((task) => [task.id, task]));
  models = models.filter((model) => model.id in dict);
}

onMount(() => {
  // Pulling update
  intervalId = setInterval(async () => {
    tasks = await studioClient.getTasksByLabel("model-pulling");
    filterModels(tasks, models);
  }, 1000);

  return localModels.subscribe((value) => {
    filterModels(tasks, value);
  })
});

onDestroy(() => {
  if(intervalId !== undefined) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
});

</script>

<NavPage title="Models on disk">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="mt-4 px-5 space-y-5 h-full">
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
        {#if models.length > 0}
        <Table
          kind="model"
          data="{models}"
          columns="{columns}"
          row={row}>
        </Table>
        {:else}
        <div>There is no model yet</div>
        {/if}
      </div>
    </div>
  </div>
</NavPage>
