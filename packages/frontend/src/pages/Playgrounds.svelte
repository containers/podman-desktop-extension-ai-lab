<script lang="ts">
import { router } from 'tinro';
import PlaygroundColumnModel from '../lib/table/playground/PlaygroundColumnModel.svelte';
import PlaygroundColumnName from '../lib/table/playground/PlaygroundColumnName.svelte';
import ConversationColumnAction from '/@/lib/table/playground/ConversationColumnAction.svelte';
import { conversations } from '/@/stores/conversations';
import PlaygroundColumnIcon from '/@/lib/table/playground/PlaygroundColumnIcon.svelte';
import { Button, EmptyScreen, Table, TableColumn, TableRow, NavPage } from '@podman-desktop/ui-svelte';
import type { Conversation } from '@shared/src/models/IPlaygroundMessage';
import { faMessage, faPlusCircle } from '@fortawesome/free-solid-svg-icons';

const columns = [
  new TableColumn<{}>('', { width: '40px', renderer: PlaygroundColumnIcon }),
  new TableColumn<Conversation>('Name', { width: '1fr', renderer: PlaygroundColumnName }),
  new TableColumn<Conversation>('Model', { width: '1fr', renderer: PlaygroundColumnModel }),
  new TableColumn<Conversation>('Actions', { width: '80px', renderer: ConversationColumnAction, align: 'right' }),
];
const row = new TableRow<Conversation>({});

function createNewPlayground() {
  router.goto('/playground/create');
}
</script>

<NavPage title="Playground Environments" searchEnabled={false}>
  <svelte:fragment slot="additional-actions">
    <Button icon={faPlusCircle} on:click={() => createNewPlayground()}>New Playground</Button>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex min-w-full">
      {#if $conversations.length > 0}
        <Table kind="playground" data={$conversations} columns={columns} row={row}></Table>
      {:else}
        <EmptyScreen
          icon={faMessage}
          title="No Playground Environment"
          message="Playground environments allow for experimenting with available models in a local environment. An intuitive user prompt helps in exploring the capabilities and accuracy of various models and aids in finding the best model for the use case at hand.">
          <div class="flex gap-2 justify-center">
            <Button type="link" on:click={() => createNewPlayground()}>Create playground</Button>
          </div>
        </EmptyScreen>
      {/if}
    </div>
  </svelte:fragment>
</NavPage>
