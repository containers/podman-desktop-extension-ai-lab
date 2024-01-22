<script lang="ts">
import { createRouteObject } from 'tinro/dist/tinro_lib';
import type { TinroRouteMeta } from 'tinro';
import { studioClient } from '/@/utils/client';

export let path = '/*';
export let fallback = false;
export let redirect = false;
export let firstmatch = false;
export let breadcrumb: string | undefined = undefined;

let showContent = false;
let params: Record<string, string> = {};
let meta: TinroRouteMeta = {} as TinroRouteMeta;

const route = createRouteObject({
  fallback,
  onShow() {
    showContent = true;
  },
  onHide() {
    showContent = false;
  },
  onMeta(newMeta: TinroRouteMeta) {
    meta = newMeta;
    params = meta.params;

    // Run fully async
    setTimeout(async () => {
      await studioClient.saveRouterState({url: newMeta.url});
    }, 0)
  },
});

$: route.update({
  path,
  redirect,
  firstmatch,
  breadcrumb,
});
</script>

{#if showContent}
  <slot params="{params}" meta="{meta}" />
{/if}
