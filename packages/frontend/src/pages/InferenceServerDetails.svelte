<script lang="ts">
import { inferenceServers } from '/@/stores/inferenceServers';
import NavPage from '/@/lib/NavPage.svelte';
import ServiceStatus from '/@/lib/table/service/ServiceStatus.svelte';
import ServiceAction from '/@/lib/table/service/ServiceAction.svelte';
import Fa from 'svelte-fa';
import { faBuildingColumns, faCopy, faMicrochip, faScaleBalanced } from '@fortawesome/free-solid-svg-icons';
import type { InferenceServer } from '@shared/src/models/IInference';

export let containerId: string | undefined = undefined;

let service: InferenceServer | undefined;
$: service = $inferenceServers.find(server => server.container.containerId === containerId);

</script>
<NavPage title="Service Details" searchEnabled="{false}">
  <svelte:fragment slot="content">
    <div slot="content" class="flex flex-col min-w-full min-h-full">
      <div class="min-w-full min-h-full flex-1">
        <div class="mt-4 px-5 space-y-5 h-full">
          {#if service !== undefined}
            <!-- container details -->
            <div class="bg-charcoal-800 rounded-md w-full px-4 pt-2 pb-4">
              <!-- container info -->
              <span class="text-sm">Container</span>
              <div class="w-full bg-charcoal-600 rounded-md p-2 flex items-center">
                <div class="grow ml-2 flex flex-row">
                  <ServiceStatus object={service} />
                  <div class="flex flex-col text-xs ml-2">
                    <span>{service.container.containerId}</span>
                  </div>
                </div>
                <ServiceAction object={service} />
              </div>

              <!-- models info -->
              <div class="mt-4">
                <span class="text-sm">Models</span>
                <div class="w-full bg-charcoal-600 rounded-md p-2 flex flex-col gap-y-4">
                  {#each service.models as model}
                    <div class="flex flex-row gap-2 items-center">
                      <div class="grow text-sm">{model.name}</div>
                      <div>
                        <div class="bg-charcoal-800 rounded-md p-2 flex flex-row w-min h-min text-xs text-charcoal-100 text-nowrap items-center" >
                          <Fa class="mr-2" icon="{faScaleBalanced}" />
                          {model.license}
                        </div>
                      </div>
                      <div>
                        <div class="bg-charcoal-800 rounded-md p-2 flex flex-row w-min h-min text-xs text-charcoal-100 text-nowrap items-center" >
                          <Fa class="mr-2" icon="{faBuildingColumns}" />
                          {model.registry}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>

            <!-- server details -->
            <div class="bg-charcoal-800 rounded-md w-full px-4 pt-2 pb-4 mt-2">
              <span class="text-sm">Server</span>
              <div class="flex flex-row gap-4">
                <div class="bg-charcoal-600 rounded-md p-2 flex flex-row w-min h-min text-xs text-nowrap items-center" >
                  http://localhost:{service.connection.port}/v1
                </div>

                <div class="bg-charcoal-600 rounded-md p-2 flex flex-row w-min h-min text-xs text-nowrap items-center" >
                  CPU Inference
                  <Fa class="ml-2" icon="{faMicrochip}" />
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
