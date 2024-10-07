<script lang="ts">
import { router } from 'tinro';
import { FormPage, Input, Button, Link } from '@podman-desktop/ui-svelte';
import { faFile, faPlus, faPlusCircle, faMinusCircle, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';
import ModelSelect from '/@/lib/select/ModelSelect.svelte';
import { modelsInfo } from '/@/stores/modelsInfo';
import { studioClient } from '/@/utils/client';
import { Uri } from '@shared/src/uri/Uri';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

let skillsFiles: string[] = $state([]);
let knowledgeFiles: string[] = $state([]);

let valid: boolean = $state(false);

let sessionName: string = $state('');
let model: ModelInfo | undefined = $state(undefined);

let trainingType: 'knowledge' | 'skills' = $state('knowledge');

$effect(() => {
  console.log(model);
  valid = (skillsFiles.length > 0 || knowledgeFiles.length > 0) && !!model && sessionName.length > 0;
});

function goToUpPage(): void {
  router.goto('/tune');
}

async function requestExplorerModal(title: string): Promise<Uri[]> {
  const results = await studioClient.openDialog({
    title: title,
    selectors: ['openFile'],
    filters: [
      {
        name: 'YAML files',
        extensions: ['yaml', 'YAML', 'yml'],
      },
    ],
  });
  if (!results) {
    return [];
  }

  return results.map(result => Uri.revive(result));
}

async function addSkills(): Promise<void> {
  const files = await requestExplorerModal('Select skills');
  skillsFiles.push(...files.map(file => file.path));
}

function removeKnowledge(file: string): void {
  knowledgeFiles = knowledgeFiles.toSpliced(knowledgeFiles.indexOf(file), 1);
}
function removeSkills(file: string): void {
  skillsFiles = skillsFiles.toSpliced(skillsFiles.indexOf(file), 1);
}

async function addKnowledge(): Promise<void> {
  const files = await requestExplorerModal('Select knowledge');
  knowledgeFiles.push(...files.map(file => file.path));
}

function setTrainingType(type: 'knowledge' | 'skills'): void {
  switch (trainingType) {
    case 'knowledge':
      skillsFiles = [];
      break;
    case 'skills':
      knowledgeFiles = [];
      break;
  }
  trainingType = type;
}

function openInstructLabDocumentation(): void {
  studioClient
    .openURL(
      'https://github.com/instructlab/instructlab?tab=readme-ov-file#-creating-new-knowledge-or-skills-and-training-the-model',
    )
    .catch((err: unknown) => {
      console.error(err);
    });
}

function submit(): void {}
</script>

<FormPage
  title="New InstructLab Session"
  breadcrumbLeftPart="InstructLab Sessions"
  breadcrumbRightPart="New session"
  breadcrumbTitle="Go back to sessions"
  onclose={goToUpPage}
  onbreadcrumbClick={goToUpPage}>
  <svelte:fragment slot="icon">
    <div class="rounded-full w-8 h-8 flex items-center justify-center">
      <Fa size="1.125x" class="text-[var(--pd-content-header-icon)]" icon={faPlus} />
    </div>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex flex-col w-full">
      <!-- form -->
      <div class="bg-[var(--pd-content-card-bg)] m-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg h-fit">
        <div class="w-full flex flex-col gap-y-4">
          <!-- model input -->
          <div>
            <label for="model" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
              >Model to Fine Tune</label>
            <ModelSelect models={$modelsInfo} disabled={false} bind:value={model} />
          </div>

          <!-- session name -->
          <div>
            <label for="session-name" class="block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
              >Session name</label>
            <Input bind:value={sessionName} class="grow" name="session-name" aria-label="session name" />
            <span class="text-[var(--pd-table-body-text)]"
              >Name of the session to be able to easily find it in your list of sessions.</span>
          </div>

          <!-- file(s) input -->
          <div class="flex flex-col gap-y-1">
            <!-- knowledge -->
            <div
              class:border-2={true}
              class="rounded-md p-5 cursor-pointer bg-[var(--pd-content-card-inset-bg)] flex flex-col gap-y-2"
              aria-label="Knowledge"
              aria-pressed={trainingType === 'knowledge' ? 'true' : 'false'}
              class:border-[var(--pd-content-card-border-selected)]={trainingType === 'knowledge'}
              class:border-[var(--pd-content-card-border)]={trainingType !== 'knowledge'}>
              <button
                title="Use Knowledge"
                class="flex flex-row align-middle items-center"
                onclick={setTrainingType.bind(undefined, 'knowledge')}>
                <div
                  class="text-2xl"
                  class:text-[var(--pd-content-card-border-selected)]={trainingType === 'knowledge'}
                  class:text-[var(--pd-content-card-border)]={trainingType !== 'knowledge'}>
                  <Fa icon={faCircleCheck} />
                </div>
                <div
                  class="pl-2"
                  class:text-[var(--pd-content-card-text)]={trainingType === 'knowledge'}
                  class:text-[var(--pd-input-field-disabled-text)]={trainingType !== 'knowledge'}>
                  Add knowledge
                </div>
              </button>

              <!-- files list -->
              <div class="flex flex-col">
                {#each knowledgeFiles as file (file)}
                  <div
                    class="bg-[var(--pd-label-bg)] text-[var(--pd-label-text)] max-w-full rounded-md px-2 py-1 mb-2 flex flex-row w-min h-min text-sm text-nowrap items-center">
                    <Fa class="mr-2" icon={faFile} />
                    <span class="overflow-x-hidden text-ellipsis max-w-full">
                      {file}
                    </span>
                    <Button on:click={removeKnowledge.bind(undefined, file)} icon={faMinusCircle} type="link" />
                  </div>
                {/each}
                <Button
                  title="Select knowledge file"
                  type="link"
                  disabled={trainingType !== 'knowledge'}
                  class={trainingType !== 'knowledge'
                    ? 'text-[var(--pd-input-field-disabled-text)] hover:bg-transparent '
                    : ''}
                  on:click={addKnowledge}
                  icon={faPlusCircle}>Add knowledge to use</Button>
                <span
                  class:text-[var(--pd-input-field-disabled-text)]={trainingType !== 'knowledge'}
                  class:text-[var(--pd-table-body-text)]={trainingType === 'knowledge'}>
                  Add a YAML file downloaded from your Knowledge contribution on InstructLab. This will create a
                  synthetic dataset based on the YAML file and retrain the model using this data.
                  <Link on:click={openInstructLabDocumentation}>Learn more about knowledge contributions</Link>
                </span>
              </div>
            </div>

            <!-- skills -->
            <div
              class:border-2={true}
              class="rounded-md p-5 cursor-pointer bg-[var(--pd-content-card-inset-bg)] flex flex-col gap-y-2"
              aria-label="Skills"
              aria-pressed={trainingType === 'skills' ? 'true' : 'false'}
              class:border-[var(--pd-content-card-border-selected)]={trainingType === 'skills'}
              class:border-[var(--pd-content-card-border)]={trainingType !== 'skills'}>
              <button
                title="Use Skills"
                class="flex flex-row align-middle items-center"
                onclick={setTrainingType.bind(undefined, 'skills')}>
                <div
                  class="text-2xl"
                  class:text-[var(--pd-content-card-border-selected)]={trainingType === 'skills'}
                  class:text-[var(--pd-content-card-border)]={trainingType !== 'skills'}>
                  <Fa icon={faCircleCheck} />
                </div>
                <div
                  class="pl-2"
                  class:text-[var(--pd-content-card-text)]={trainingType === 'skills'}
                  class:text-[var(--pd-input-field-disabled-text)]={trainingType !== 'skills'}>
                  Add skills
                </div>
              </button>
              <!-- files list -->
              <div class="flex flex-col">
                {#each skillsFiles as file (file)}
                  <div
                    class="bg-[var(--pd-label-bg)] text-[var(--pd-label-text)] max-w-full rounded-md px-2 py-1 mb-2 flex flex-row w-min h-min text-sm text-nowrap items-center">
                    <Fa class="mr-2" icon={faFile} />
                    <span class="overflow-x-hidden text-ellipsis max-w-full">
                      {file}
                    </span>
                    <Button on:click={removeSkills.bind(undefined, file)} icon={faMinusCircle} type="link" />
                  </div>
                {/each}
                <Button
                  title="Select skill file"
                  on:click={addSkills}
                  disabled={trainingType !== 'skills'}
                  icon={faPlusCircle}
                  type="link"
                  class={trainingType !== 'skills'
                    ? 'text-[var(--pd-input-field-disabled-text)] hover:bg-transparent '
                    : ''}>Add skill to use</Button>
                <span
                  class:text-[var(--pd-input-field-disabled-text)]={trainingType !== 'skills'}
                  class:text-[var(--pd-table-body-text)]={trainingType === 'skills'}>
                  Add a YAML file downloaded from your skills contribution on InstructLab. This will create a synthetic
                  dataset based on the YAML file and retrain the model using this data.
                  <Link on:click={openInstructLabDocumentation}>Learn more about skills contributions</Link>
                </span>
              </div>
            </div>
          </div>
        </div>
        <footer>
          <div class="w-full flex flex-col">
            <Button title="Start session" inProgress={false} on:click={submit} disabled={!valid} icon={faPlusCircle}>
              Start session
            </Button>
          </div>
        </footer>
      </div>
    </div>
  </svelte:fragment>
</FormPage>
