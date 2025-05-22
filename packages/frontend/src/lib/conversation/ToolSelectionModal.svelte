<script lang="ts">
import { Button, Checkbox, Modal } from '@podman-desktop/ui-svelte';
import { faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';
import type { McpServer } from '@shared/models/McpSettings';

interface Props {
  mcpServers: McpServer[];
}
let { mcpServers = [] }: Props = $props();
let open: boolean = $state(false);

const toggle = (): void => {
  open = !open;
};

// TEMPORARY: Prevent tool unchecking
let checked = $state(true);
$effect(() => {
  if (!checked) {
    checked = true;
  }
});
</script>

<div>
  <Button type="secondary" icon={faScrewdriverWrench} padding="py-1 px-2" on:click={toggle} title="MCP Servers">
    MCP Servers
  </Button>
  {#if open}
    <Modal on:close={toggle}>
      <div
        data-testid="tool-selection-modal-tool-container"
        class="text-[var(--pd-dropdown-item-text)] text-lg rounded-sm bg-[var(--pd-dropdown-bg)] divide-y divide-[var(--pd-dropdown-divider)]">
        {#each mcpServers as server (server.name)}
          <div
            data-testid="tool-selection-modal-tool-item"
            class="py-1 px-2 flex gap-1 items-center select-none hover:bg-[var(--pd-dropdown-item-hover-bg)] hover:text-[var(--pd-dropdown-item-hover-text)]">
            <Checkbox bind:checked={checked} />
            {server.name}
          </div>
        {/each}
      </div>
    </Modal>
  {/if}
</div>
