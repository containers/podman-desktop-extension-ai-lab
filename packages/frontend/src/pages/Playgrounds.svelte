<script lang="ts">
import { router } from 'tinro';
import NavPage from '../lib/NavPage.svelte';
import Button from '../lib/button/Button.svelte';
import Table from '../lib/table/Table.svelte';
import PlaygroundColumnModel from '../lib/table/playground/PlaygroundColumnModel.svelte';
import PlaygroundColumnName from '../lib/table/playground/PlaygroundColumnName.svelte';
import { Row, Column } from '../lib/table/table';
import { conversations } from '/@/stores/conversations';
import type { Conversation } from '@shared/src/models/IPlaygroundMessage';

const columns: Column<Conversation>[] = [
  new Column<Conversation>('Name', { width: '1fr', renderer: PlaygroundColumnName }),
  new Column<Conversation>('Model', { width: '1fr', renderer: PlaygroundColumnModel }),
];
const row = new Row<Conversation>({});

function createNewPlayground() {
  router.goto('/playground/create');
}
</script>

<NavPage title="Playgrounds environments" searchEnabled="{false}">
  <svelte:fragment slot="additional-actions">
    <Button on:click="{() => createNewPlayground()}">New Playground</Button>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div slot="content" class="flex flex-col min-w-full">
      <div class="min-w-full flex-1">
        <div class="mt-4 px-5 space-y-5">
          {#if $conversations.length > 0}
            <Table kind="playground" data="{$conversations}" columns="{columns}" row="{row}"></Table>
          {:else}
            <div role="status">
              There is no playground environment for now. You can <a
                href="{'javascript:void(0);'}"
                class="underline"
                role="button"
                title="Create a new Playground environment"
                on:click="{createNewPlayground}">create one now</a
              >.
            </div>
          {/if}
        </div>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
