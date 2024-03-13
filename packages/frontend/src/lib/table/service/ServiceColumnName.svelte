<script lang="ts">
import type { InferenceServer } from '@shared/src/models/IInference';
export let object: InferenceServer;
</script>

<button class="text-sm text-gray-700">
  {object.container.containerId}
</button>
