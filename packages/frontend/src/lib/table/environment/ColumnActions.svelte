<script lang="ts">
import EnvironmentActions from '../../EnvironmentActions.svelte';
import type { EnvironmentCell } from '/@/pages/environments';
export let object: EnvironmentCell;
</script>

<EnvironmentActions recipeId="{object.recipeId}" modelId="{object.modelId}" object="{object.envState}" />
