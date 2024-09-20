<script lang="ts">
import { conversations } from '../stores/conversations';
import { catalog } from '../stores/catalog';
import { afterUpdate } from 'svelte';

import { inferenceServers } from '/@/stores/inferenceServers';
import { DetailsPage, StatusIcon } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
import ConversationActions from '../lib/conversation/ConversationActions.svelte';
import { ContainerIcon } from '@podman-desktop/ui-svelte/icons';

export let playgroundId: string;

$: conversation = $conversations.find(conversation => conversation.id === playgroundId);
$: model = $catalog.models.find(model => model.id === conversation?.modelId);
$: server = $inferenceServers.find(is => conversation && is.models.map(mi => mi.id).includes(conversation?.modelId));

afterUpdate(() => {
  if (!conversation) {
    router.goto('/playgrounds');
  }
});

function getStatusForIcon(status?: string, health?: string): string {
  switch (status) {
    case 'running':
      switch (health) {
        case 'healthy':
          return 'RUNNING';
        case 'starting':
          return 'STARTING';
        default:
          return 'NOT-RUNNING';
      }
    default:
      return 'NOT-RUNNING';
  }
}

export function goToUpPage(): void {
  router.goto('/playgrounds');
}

</script>

{#if conversation}
  <DetailsPage
    title={conversation?.name}
    breadcrumbLeftPart="Playgrounds"
    breadcrumbRightPart={conversation?.name}
    breadcrumbTitle="Go back to Playgrounds"
    onclose={goToUpPage}
    onbreadcrumbClick={goToUpPage}>
    <svelte:fragment slot="icon">
      <div class="mr-3">
        <StatusIcon icon={ContainerIcon} size={24} status={getStatusForIcon(server?.status, server?.health?.Status)} />
      </div>
    </svelte:fragment>
    <svelte:fragment slot="subtitle">
      <div class="flex gap-x-2 items-center text-[var(--pd-content-sub-header)]">
        {#if model}
          <div class="text-sm" aria-label="Model name">
            <a href="/model/{model.id}">{model.name}</a>
          </div>
        {/if}
      </div>
    </svelte:fragment>
    <svelte:fragment slot="actions">
      <ConversationActions detailed conversation={conversation} />
    </svelte:fragment>
    <svelte:fragment slot="content">
      <div class="w-full h-full bg-[var(--pd-content-bg)]">
        <div class="h-full overflow-auto">
          <iframe
            class="h-full w-full"
            title={conversation.name}
            src="http://localhost:{conversation.container?.port}?lang=en"></iframe>
        </div>
      </div>
    </svelte:fragment>
  </DetailsPage>
{/if}
