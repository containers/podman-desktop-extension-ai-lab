<script lang="ts">
import { type InferenceServerInfo, RuntimeType } from '@shared/src/models/IInference';
export let object: InferenceServerInfo;

function getProviderColour(providerName: string): string {
  switch (providerName?.toLowerCase()) {
    case RuntimeType.PODMAN:
      return 'bg-purple-600';
    case RuntimeType.KUBERNETES:
      return 'bg-sky-600';
    default:
      return 'bg-gray-900';
  }
}
</script>

<div
  class="flex items-center bg-[var(--pd-label-bg)] p-1 rounded-md text-xs text-[var(--pd-label-text)] gap-x-1 capitalize">
  <div class="w-2 h-2 {getProviderColour(object.runtime)} rounded-full"/>
  {object.runtime}
</div>
