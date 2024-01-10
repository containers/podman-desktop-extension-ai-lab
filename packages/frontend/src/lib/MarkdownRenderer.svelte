<script lang="ts">
  import SvelteMarkdown from 'svelte-markdown'
  export let source: string | undefined;
</script>

<article class="prose min-w-full">
  <SvelteMarkdown {source} />
</article>

