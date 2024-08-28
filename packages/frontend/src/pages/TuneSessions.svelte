<script>
import { faGaugeHigh, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { Button, EmptyScreen, NavPage } from '@podman-desktop/ui-svelte';

function start() {}
</script>

<NavPage title="InstructLab Sessions" searchEnabled={false}>
  <svelte:fragment slot="additional-actions">
    <Button icon={faPlusCircle} on:click={() => start()}>Start Fine Tuning</Button>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex min-w-full">
      <EmptyScreen
        icon={faGaugeHigh}
        title="No InstructLab Session"
        message="Create InstructLab session to improve trained models with specialized knowledges and skills tuning">
        <div class="flex gap-2 justify-center">
          <Button type="link" on:click={() => start()}>Create InstructLab Session</Button>
        </div>
      </EmptyScreen>
    </div>
  </svelte:fragment>
</NavPage>
