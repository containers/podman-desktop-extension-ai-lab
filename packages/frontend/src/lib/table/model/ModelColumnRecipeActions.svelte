<script lang="ts">
import { faArrowRotateRight } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '../../button/ListItemButtonIcon.svelte';
import { createEventDispatcher } from 'svelte';
import type { RecipeModelInfo } from '/@/models/RecipeModelInfo';
export let object: RecipeModelInfo;

const dispatch = createEventDispatcher<{ update: RecipeModelInfo }>();

function selectModel() {
  object.inUse = true;
  dispatch('update', object);
}
</script>

<ListItemButtonIcon
  icon="{faArrowRotateRight}"
  onClick="{selectModel}"
  title="Use this model when running application"
  enabled="{!object.inUse}" />
