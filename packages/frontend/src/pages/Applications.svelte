<script lang="ts">
import { NavPage, EmptyScreen } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
import { faRocket } from '@fortawesome/free-solid-svg-icons';
import TasksBanner from '/@/lib/progress/TasksBanner.svelte';
import ApplicationTable from '/@/lib/table/application/ApplicationTable.svelte';

const openApplicationCatalog = () => {
  router.goto('/recipes');
};
</script>

<NavPage title="AI Apps" searchEnabled={false}>
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <!-- showing running tasks -->
      <TasksBanner title="Pulling recipes" labels={{ 'recipe-pulling': undefined }} />

      <ApplicationTable>
        <svelte:fragment slot="empty-screen">
          <EmptyScreen
            icon={faRocket}
            title="No application running"
            message="There is no AI App running"
            onClick={openApplicationCatalog} />
        </svelte:fragment>
      </ApplicationTable>
    </div>
  </div>
</NavPage>
