<script lang="ts">
  import type { EnvironmentState } from "@shared/src/models/IEnvironmentState";
  export let object: EnvironmentState;
</script>

<div class="text-sm text-gray-700">
  {object.status}
</div>
