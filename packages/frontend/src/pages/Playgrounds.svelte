<script lang="ts">
import { router } from 'tinro';
import PlaygroundColumnModel from '../lib/table/playground/PlaygroundColumnModel.svelte';
import PlaygroundColumnName from '../lib/table/playground/PlaygroundColumnName.svelte';
import ConversationColumnAction from '/@/lib/table/playground/ConversationColumnAction.svelte';
import { conversations } from '/@/stores/conversations';
import PlaygroundColumnIcon from '/@/lib/table/playground/PlaygroundColumnIcon.svelte';
import { Button } from '@podman-desktop/ui-svelte';
import { Table, TableColumn, TableRow, NavPage } from '@podman-desktop/ui-svelte';
import type { Conversation } from '@shared/src/models/IPlaygroundMessage';

const columns = [
  new TableColumn<{}>('', { width: '40px', renderer: PlaygroundColumnIcon }),
  new TableColumn<Conversation>('Name', { width: '1fr', renderer: PlaygroundColumnName }),
  new TableColumn<Conversation>('Model', { width: '1fr', renderer: PlaygroundColumnModel }),
  new TableColumn<Conversation>('Actions', { width: '40px', renderer: ConversationColumnAction, align: 'center' }),
];
const row = new TableRow<Conversation>({});

function createNewPlayground() {
  router.goto('/playground/create');
}

const openServicesPage = () => {
  router.goto('/services');
};
</script>

<NavPage title="Playground Environments" searchEnabled="{false}">
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
            <div class="text-[var(--pd-details-body-text)]">
              <div role="status">
                There is no playground environment. You can <a
                  href="{'javascript:void(0);'}"
                  class="underline"
                  role="button"
                  title="Create a new Playground environment"
                  on:click="{createNewPlayground}">create one now</a
                >.
              </div>
              <p>
                Playground environments allow for experimenting with available models in a local environment. An
                intuitive user prompt helps in exploring the capabilities and accuracy of various models and aids in
                finding the best model for the use case at hand.
              </p>
              <p>
                Once started, each playground ships with a generic chat client to interact with the model service. The <button
                  class="underline"
                  title="Open the Services page"
                  on:click="{openServicesPage}">Services</button>
                page allows for accessing running model services and provides further details and code snippets to interact
                with them.
              </p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
