<script lang="ts">
import EnvironmentActions from '../../EnvironmentActions.svelte';
import type { ApplicationCell } from '../../../pages/applications';
export let object: ApplicationCell;
</script>

<EnvironmentActions recipeId="{object.recipeId}" modelId="{object.modelId}" object="{object.envState}" />
