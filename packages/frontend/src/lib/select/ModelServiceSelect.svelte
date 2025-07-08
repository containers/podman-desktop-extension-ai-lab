<script lang="ts">
import Select from '/@/lib/select/Select.svelte';
import type { InferenceServer } from '@shared/models/IInference';

interface Props {
  servers: InferenceServer[];
  disabled?: boolean;
  value: InferenceServer | undefined;
}

let { servers = [], disabled = false, value = $bindable() }: Props = $props();

// Format each server to an option for the select component
const options = servers.map(server => ({
  ...server,
  value: server.container.containerId,
  label: `${server.container.containerId.slice(0, 8)} (port ${server.connection.port}) - ${server.type} - ${server.status}`,
}));

let selected: (InferenceServer & { label: string; value: string }) | undefined = $derived.by(() => {
  if (value) {
    return {
      ...value,
      label: `${value.container.containerId.slice(0, 8)} (port ${value.connection.port}) - ${value.type} - ${value.status}`,
      value: value.container.containerId,
    };
  } else {
    return undefined;
  }
});

function handleOnChange(nValue: (InferenceServer & { label: string; value: string }) | undefined): void {
  if (nValue) {
    const { label, ...server } = nValue;
    value = server as InferenceServer;
  } else {
    value = undefined;
  }
}
</script>

<Select
  label="Select Model Service"
  name="select-model-service"
  disabled={disabled}
  value={selected}
  onchange={handleOnChange}
  placeholder="Select an inference server"
  items={options} />
