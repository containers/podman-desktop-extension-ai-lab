<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';

interface Props {
  title?: string;
  link: string;
  image: string;
  isVideo?: boolean;
}

let { title, link, image, isVideo = false }: Props = $props();

async function openLink(): Promise<void> {
  await studioClient.openURL(link);
}
</script>

<div
  class="flex flex-col flex-1 justify-between gap-4 m-2 bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)] rounded-md items-center">
  <img src={image} class="h-[200px] w-full object-cover rounded-md" alt={`${title} image`} />
  <div class="text-[var(--pd-content-card-carousel-card-header-text)] text-center font-semibold px-2">{title}</div>
  <Button on:click={openLink} class="self-center mb-2">{isVideo ? 'Watch' : 'Read more'}</Button>
</div>
