<script lang="ts">
import { NavPage, EmptyScreen, Button } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
import { faServer } from '@fortawesome/free-solid-svg-icons';
import TasksBanner from '/@/lib/progress/TasksBanner.svelte';
import ApplicationTable from '/@/lib/table/application/ApplicationTable.svelte';

const openApplicationCatalog = () => {
  router.goto('/recipes');
};
</script>

<NavPage title="AI Apps" searchEnabled={false}>
  <div slot="content" class="flex flex-col min-w-full min-h-full space-y-5">
    <!-- showing running tasks -->
    <div class="w-full">
      <TasksBanner title="Pulling recipes" labels={{ 'recipe-pulling': undefined }} />
    </div>

    <div class="flex w-full h-full">
      <ApplicationTable>
        <svelte:fragment slot="empty-screen">
          <EmptyScreen
            icon={faServer}
            title="No application running"
            message="There is no AI App running. You can go to Recipes page to start an application.">
            <div class="flex gap-2 justify-center">
              <Button type="link" on:click={() => openApplicationCatalog()}>Recipes</Button>
            </div>
          </EmptyScreen>
        </svelte:fragment>
      </ApplicationTable>
    </div>
  </div>
</NavPage>
