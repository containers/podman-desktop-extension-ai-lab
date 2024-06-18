<script lang="ts">
import { createRouteObject } from 'tinro/dist/tinro_lib';
import type { TinroRouteMeta } from 'tinro';
import { saveRouterState } from '/@/utils/client';

export let path = '/*';
export let fallback = false;
export let redirect = false;
export let firstmatch = false;

export let isAppMounted: boolean = false;

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

    if (isAppMounted) {
      saveRouterState({ url: newMeta.url });
    }
  },
});

$: route.update({
  path,
  redirect,
  firstmatch,
});
</script>

{#if showContent}
  <slot params="{params}" meta="{meta}" />
{/if}
