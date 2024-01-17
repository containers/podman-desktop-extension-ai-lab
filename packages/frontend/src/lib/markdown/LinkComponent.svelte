<script lang="ts">
import { studioClient } from '/@/utils/client.js';

export let href: string = "";
export let title: string | undefined = undefined;
export let text: string = "";

const onClick = () => {
  studioClient.openURL(href);
}
</script>
<!-- href set to void operator to avoid any redirect -->
<a href="{'javascript:void(0);'}" role="button" title="{title}" on:click={onClick}>{text}</a>
