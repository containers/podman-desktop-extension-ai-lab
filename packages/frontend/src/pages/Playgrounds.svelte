<script lang="ts">
import NavPage from '../lib/NavPage.svelte';
import Table from '../lib/table/Table.svelte';
import PlaygroundColumnModel from '../lib/table/playground/PlaygroundColumnModel.svelte';
import PlaygroundColumnName from '../lib/table/playground/PlaygroundColumnName.svelte';
import { Row, Column } from '../lib/table/table';
import { playgroundsList, type PlaygroundInfo } from './playgrounds';

const columns: Column<PlaygroundInfo>[] = [
  new Column<PlaygroundInfo>('Name', { width: '1fr', renderer: PlaygroundColumnName }),
  new Column<PlaygroundInfo>('Model', { width: '1fr', renderer: PlaygroundColumnModel }),
];
const row = new Row<PlaygroundInfo>({});
</script>

<NavPage title="Playgrounds environments" searchEnabled="{false}">
  <svelte:fragment slot="content">
    <div slot="content" class="flex flex-col min-w-full min-h-full">
      <div class="min-w-full min-h-full flex-1">
        <div class="mt-4 px-5 space-y-5 h-full">
          <Table kind="playground" data="{playgroundsList}" columns="{columns}" row="{row}"></Table>
        </div>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
