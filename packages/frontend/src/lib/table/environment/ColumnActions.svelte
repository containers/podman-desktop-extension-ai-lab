<script lang="ts">
import EnvironmentControls from "../../EnvironmentControls.svelte";
import type { EnvironmentCell } from "/@/pages/environments";
export let object: EnvironmentCell;
</script>

<EnvironmentControls recipeId={object.recipeId} object={object.envState} tasks={object.tasks}/>
