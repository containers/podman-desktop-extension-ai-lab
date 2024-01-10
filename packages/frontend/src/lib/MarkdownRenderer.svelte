<script>
  import SvelteMarkdown from 'svelte-markdown'
  const source = `## This file is string markdown

\`\`\`
This would be pulled from a git repository (for now it is mocked)
\`\`\`
This is a paragraph.

* This is a list
* With two items
  1. And a sublist
  2. That is ordered
    * With another
    * Sublist inside

| And this is | A table |
|-------------|---------|
| With two    | columns |

## _does images are working ?_
![MarineGEO circle logo](https://marinegeo.github.io/assets/img/MarineGEO_logo.png)
`

</script>

<article class="prose min-w-full">
  <SvelteMarkdown {source} />
</article>

