<script lang="ts">
import { HighlightAuto, LineNumbers } from 'svelte-highlight';
import githubDark from 'svelte-highlight/styles/github-dark';

export let code: string;
</script>

<svelte:head>
  <style>
  .hljs {
    background: #0f0f11 !important;
  }
  </style>
  {@html githubDark}
</svelte:head>

<HighlightAuto code="{code}" let:highlighted>
  <LineNumbers highlighted="{highlighted}" --langtag-background="#0f0f11" wrapLines />
</HighlightAuto>
