<script lang="ts">
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { NavPage, Button, Link } from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';
import { router } from 'tinro';
import fineTunningLargeModelsWithInstructLab from '/@/lib/images/fineTunningLargeModelsWithInstructLab.png';
import instructLabDemocratizingAIModelsAtScale from '/@/lib/images/instructLabDemocratizingAIModelsAtScale.png';
import instructLabArchitectureImplementationOverview from '/@/lib/images/instructLabArchitectureImplementationOverview.png';
import howInstructLabsSyntheticDataGenerationEnhancesLLM from '/@/lib/images/howInstructLabsSyntheticDataGenerationEnhancesLLM.png';
import instructLabTitleImage from '/@/lib/images/instructLabTitleImage.png';
import AboutInstructLabDiscoverCard from './AboutInstructLabDiscoverCard.svelte';
import AboutInstructLabExploreCard from './AboutInstructLabExploreCard.svelte';

function start(): void {
  router.goto('/tune/start');
}

const instructLabDocumentation = 'https://docs.instructlab.ai/';
const instructLabHuggingFace = 'https://huggingface.co/instructlab';
const instructLabSamples = '';

async function openInstructLabDocumentation(): Promise<void> {
  await studioClient.openURL(instructLabDocumentation);
}

async function openInstructLabHuggingFace(): Promise<void> {
  await studioClient.openURL(instructLabHuggingFace);
}

async function openSamples(): Promise<void> {
  await studioClient.openURL(instructLabSamples);
}
</script>

<NavPage title="About InstructLab" searchEnabled={false}>
  <div slot="additional-actions">
    <Button icon={faPlusCircle} on:click={start}>Start Fine Tuning</Button>
  </div>
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="text-[var(--pd-details-body-text)] mt-4 px-5 space-y-5" aria-label="inner-content">
        <div class="flex bg-[var(--pd-content-card-bg)] rounded-md p-5 gap-3 flex-row flex-nowrap items-center">
          <img
            src={instructLabTitleImage}
            class="max-h-[100%] w-auto max-w-[20%] object-contain rounded-md self-start"
            alt={`InstructLab`} />
          <div class="flex flex-col flex-1 h-100% self-start gap-4">
            <div
              class="text-[var(--pd-content-card-text)] truncate text-ellipsis overflow-hidden whitespace-pre-line flex flex-col gap-4">
              <div>
                Here you can create an InstructLab session to improve trained models with specialized knowledge and
                skill tuning. InstructLab is a model-agnostic open source AI project that facilitates contributions to
                Large Language Models (LLMs).
              </div>
              <div>Start by trying one of our samples or bring your own knowledge and skills files.</div>
            </div>
            <div class="flex flex-row justify-start items-center gap-3 mt-2">
              <Link on:click={openInstructLabDocumentation}>Access InstructLab documentation</Link>
              <Link on:click={openInstructLabHuggingFace}>View InstructLab on HuggingFace</Link>
            </div>
          </div>
        </div>

        <!-- Remove hidden once we have some samples data -->
        <div class="flex flex-1 flex-col hidden">
          <p class="text-xl text-[var(--pd-details-body-text)]">
            Discover from available <Link on:click={openSamples} class="font-bold">SAMPLES</Link>
          </p>
          <div class="flex flex-col pt-5 grow">
            <div class="grid grid-cols-3 gap-x-2">
              <AboutInstructLabDiscoverCard title={'asdas'} link={'asd'} image={instructLabTitleImage} desc={'aaaa'} />
              <AboutInstructLabDiscoverCard title={'asdas'} link={'asd'} image={instructLabTitleImage} desc={'aaaa'} />
              <AboutInstructLabDiscoverCard title={'asdas'} link={'asd'} image={instructLabTitleImage} desc={'aaaa'} />
            </div>
          </div>
        </div>
        <div class="flex flex-1 flex-col">
          <p class="text-xl text-[var(--pd-details-body-text)]">Explore articles and videos</p>
          <div
            class="rounded-md my-5 bg-[var(--pd-content-card-bg)] grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] p-2">
            <AboutInstructLabExploreCard
              title="InstructLab: Democratizing AI Models at Scale"
              link="https://www.ibm.com/training/course/instructlab-democratizing-ai-models-at-scale-DL01001G"
              image={instructLabDemocratizingAIModelsAtScale} />
            <AboutInstructLabExploreCard
              title="Fine Tuning Large Language Models with InstructLab"
              link="https://www.youtube.com/watch?v=pu3-PeBG0YU"
              image={fineTunningLargeModelsWithInstructLab}
              isVideo={true} />
            <AboutInstructLabExploreCard
              title="How InstructLab’s synthetic data generation enhances LLMs"
              link="https://www.redhat.com/en/blog/how-instructlabs-synthetic-data-generation-enhances-llms"
              image={howInstructLabsSyntheticDataGenerationEnhancesLLM} />
            <AboutInstructLabExploreCard
              title="InstructLab Architecture & Implementation Overview"
              link="https://blog.instructlab.ai/2024/11/instructlab-architecture-implementation-overview/"
              image={instructLabArchitectureImplementationOverview} />
          </div>
        </div>
      </div>
    </div>
  </div>
</NavPage>
