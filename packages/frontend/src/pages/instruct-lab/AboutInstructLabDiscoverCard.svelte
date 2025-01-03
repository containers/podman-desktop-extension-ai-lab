<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';

interface Props {
  title: string;
  desc: string;
  link: string;
  image: string;
}

let { title, desc, link, image }: Props = $props();

async function openLink(): Promise<void> {
  await studioClient.openURL(link);
}
</script>

<div
  class="flex flex-col items-center justify-top rounded-md text-white relative bg-cover bg-center h-[300px]"
  style={`background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0) 80%), url(${image});`}>
  <div class="text-lg font-bold mt-2 px-2">{title}</div>
  <div class="text-sm my-2 px-2">{desc}</div>
  <Button on:click={openLink}>Get started</Button>
</div>
