<script lang="ts">
export let message: string | undefined = undefined;
export let title: string = 'Expand';
let showMessage: boolean = false;
</script>

{#if message}
  <div role="note" class:hidden="{!showMessage}" class="text-xs my-2 break-words">{message}</div>
  <div class="flex flex-col w-full items-end">
    <button on:click="{() => (showMessage = !showMessage)}" class="text-[var(--pd-link)] text-xs">
      {title}
      {#if showMessage}
        <i class="fas fa-chevron-up"></i>
      {:else}
        <i class="fas fa-chevron-down"></i>
      {/if}
    </button>
  </div>
{/if}
