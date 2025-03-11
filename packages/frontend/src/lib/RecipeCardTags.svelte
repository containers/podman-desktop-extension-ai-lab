<script lang="ts">
import type { Recipe } from '@shared/src/models/IRecipe';
import Badge from './Badge.svelte';
import { onDestroy, onMount } from 'svelte';
import { TOOLS, FRAMEWORKS, getBGColor, getTextColor } from '/@/lib/RecipeCardTags';

interface Props {
  recipe: Recipe;
}

let { recipe }: Props = $props();

const TAGS: string[] = [
  ...recipe.categories,
  ...(recipe.backend !== undefined ? [recipe.backend] : []),
  ...(recipe.frameworks ?? []),
  ...(recipe.languages ?? []),
];

// gap-2 = 8px
const PADDING = 8;
let expanded: boolean = $state(false);
let toggleButton: HTMLDivElement | undefined = $state();
let visibleTags: string[] = $state(TAGS);
let divTags: HTMLDivElement[] = $state([]);
let recipeCardWidth: number = $state(0);

function updateContent(tag: string): string {
  let updatedTag = tag;
  if (tag === 'natural-language-processing' || tag === 'computer-vision') {
    updatedTag = tag.replaceAll('-', ' ');
  }

  // Make first character uppercase only on use cases and languages
  if (FRAMEWORKS.includes(updatedTag) || TOOLS.includes(updatedTag)) {
    return updatedTag;
  }

  return updatedTag.replace(/\b\w/g, char => char.toUpperCase());
}

function updateVisibleTags(): void {
  if (expanded) {
    visibleTags = TAGS;
    return;
  }

  if (!toggleButton) {
    return;
  }

  if (TAGS.length !== visibleTags.length) {
    toggleButton.classList.remove('hidden');
  }

  removeHiddenFromTags();

  // default value is button for toggle
  let totalWidth = PADDING + toggleButton.clientWidth;
  visibleTags = [];
  for (let i = 0; i < TAGS.length; i++) {
    const tag = divTags[i];
    const tagWidth = tag.clientWidth + PADDING;

    if (totalWidth + tagWidth >= recipeCardWidth) {
      addHiddenToTags(TAGS[i]);
      return;
    } else {
      totalWidth += tagWidth;
      visibleTags.push(TAGS[i]);
    }
  }

  if (TAGS.length === visibleTags.length) {
    toggleButton.classList.add('hidden');
  }
}

// Adds hidden class to all tags after afterTag
function addHiddenToTags(afterTag: string): void {
  let isAfterTag = false;
  for (let i = 0; i < TAGS.length; i++) {
    const divTag = divTags[i];
    if (isAfterTag) {
      divTag.classList.add('hidden');
    } else if (TAGS[i] === afterTag) {
      divTag.classList.add('hidden');
      isAfterTag = true;
    }
  }
}

// Remove the hidden class from all the tags (this will result in div element having clientWidth)
function removeHiddenFromTags(): void {
  divTags.forEach(tag => {
    tag.classList.remove('hidden');
  });
  visibleTags = TAGS;
}

onMount((): void => {
  updateVisibleTags();
  window.addEventListener('resize', updateVisibleTags);
});

onDestroy((): void => window.removeEventListener('resize', updateVisibleTags));

function toggleExpanded(): void {
  removeHiddenFromTags();
  expanded = !expanded;
  updateVisibleTags();
}
</script>

<div
  bind:clientWidth={recipeCardWidth}
  class="w-full flex flex-row gap-2 py-2"
  class:overflow-hidden={!expanded}
  class:flex-wrap={expanded}>
  {#each TAGS as tag, i (tag)}
    <div bind:this={divTags[i]}>
      <Badge class="{getBGColor(tag)} {getTextColor(tag)}" content={updateContent(tag)} />
    </div>
  {/each}

  <div bind:this={toggleButton}>
    <button onclick={toggleExpanded}>
      <Badge
        class="bg-transparent text-[var(--pd-link)]"
        content={expanded ? 'Show less' : `+${TAGS.length - visibleTags.length} more`} />
    </button>
  </div>
</div>
