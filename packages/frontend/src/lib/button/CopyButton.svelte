<script lang="ts">
import { Tooltip } from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';
import type { Snippet } from 'svelte';

let {
  content,
  class: classes,
  children,
}: { class: string | undefined; content: string; children: Snippet | undefined } = $props();
let status: 'idle' | 'copied' = $state('idle');

function copy(content: string): void {
  if (status !== 'idle') return;
  studioClient
    .copyToClipboard(content)
    .then(() => {
      status = 'copied';
    })
    .catch((err: unknown) => {
      console.error(err);
    });
}

function reset(): void {
  status = 'idle';
}

function handleClick(): void {
  copy(content);
}
</script>

<Tooltip bottom tip={status === 'idle' ? 'Copy' : 'Copied'}>
  <button onmouseleave={reset} onclick={handleClick} class={`${classes} cursor-copy`}>
    {#if children}
      {@render children()}
    {/if}
  </button>
</Tooltip>
