<script>
import ContentDetailsLayout from './ContentDetailsLayout.svelte';
</script>

<ContentDetailsLayout detailsTitle="a title" detailsLabel="a label" detailsSummary="a summary">
  <svelte:fragment slot="content">A Content</svelte:fragment>
  <svelte:fragment slot="details">Details...</svelte:fragment>
</ContentDetailsLayout>
