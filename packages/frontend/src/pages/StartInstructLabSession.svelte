<script lang="ts">
import { router } from 'tinro';
import { FormPage, Input, Button, Tooltip } from '@podman-desktop/ui-svelte';
import { faFile, faPlus, faPlusCircle, faMinusCircle, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';
import ModelSelect from '/@/lib/select/ModelSelect.svelte';
import { modelsInfo } from '/@/stores/modelsInfo';
import { studioClient } from '/@/utils/client';
import { Uri } from '@shared/src/uri/Uri';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

let skills_files: string[] = $state([]);
let knowledge_files: string[] = $state([]);

let valid: boolean = $state(false);

let sessionName: string = $state('');
let model: ModelInfo | undefined = $state(undefined);

$effect(() => {
  console.log(model);
  valid = (skills_files.length > 0 || knowledge_files.length > 0) && !!model && sessionName.length > 0;
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
  console.log('addSkills requestExplorerModal');
  const files = await requestExplorerModal('Select skills');
  console.log('files', files);
  skills_files.push(...files.map(file => file.path));
}

function removeKnowledge(file: string): void {
  knowledge_files = knowledge_files.toSpliced(knowledge_files.indexOf(file), 1);
}
function removeSkills(file: string): void {
  skills_files = skills_files.toSpliced(skills_files.indexOf(file), 1);
}

async function addKnowledge(): Promise<void> {
  const files = await requestExplorerModal('Select knowledge');
  knowledge_files.push(...files.map(file => file.path));
}

function openInstructLabDocumentation(): void {
  studioClient.openURL('https://github.com/instructlab/instructlab?tab=readme-ov-file#-creating-new-knowledge-or-skills-and-training-the-model')
    .catch((err: unknown) => {
      console.error(err);
    });
}

function submit(): void {}
</script>

<FormPage
  title="Start InstructLab Session"
  breadcrumbLeftPart="sessions"
  breadcrumbRightPart="Start session"
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
        <div class="w-full">
          <!-- model input -->
          <label for="model" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
            >Model to Fine Tune</label>
          <ModelSelect models={$modelsInfo} disabled={false} bind:value={model} />

          <!-- knowledge input -->
          <div class="pt-4 mb-2 flex text-[var(--pd-content-card-header-text)] items-center gap-y-2">
            <label for="knowledge" class="font-bold">Knowledge</label>
            <Tooltip tip="Learn more about skills">
              <Button
                on:click={openInstructLabDocumentation}
                icon={faQuestionCircle}
                type="link" />
            </Tooltip>
          </div>
          {#each knowledge_files as file}
            <div
              class="bg-[var(--pd-label-bg)] text-[var(--pd-label-text)] max-w-full rounded-md px-2 py-1 mb-2 flex flex-row w-min h-min text-sm text-nowrap items-center">
              <Fa class="mr-2" icon={faFile} />
              <span class="overflow-x-hidden text-ellipsis max-w-full">
                {file}
              </span>
              <Button
                on:click={function (): void {
                  removeKnowledge(file);
                }}
                icon={faMinusCircle}
                type="link" />
            </div>
          {/each}
          <Button on:click={addKnowledge} icon={faPlusCircle} type="link">Add knowledge to use</Button>

          <!-- skills input -->
          <div class="pt-4 mb-2 flex text-[var(--pd-content-card-header-text)] items-center gap-y-2">
            <label for="skills" class="font-bold">Skills</label>
            <Tooltip tip="Learn more about skills">
              <Button
                on:click={openInstructLabDocumentation}
                icon={faQuestionCircle}
                type="link" />
            </Tooltip>
          </div>
          {#each skills_files as file}
            <div
              class="bg-[var(--pd-label-bg)] text-[var(--pd-label-text)] max-w-full rounded-md px-2 py-1 mb-2 flex flex-row w-min h-min text-sm text-nowrap items-center">
              <Fa class="mr-2" icon={faFile} />
              <span class="overflow-x-hidden text-ellipsis max-w-full">
                {file}
              </span>
              <Button
                on:click={function (): void {
                  removeSkills(file);
                }}
                icon={faMinusCircle}
                type="link" />
            </div>
          {/each}
          <Button on:click={addSkills} icon={faPlusCircle} type="link">Add skill to use</Button>

          <label for="model" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
            >Session name</label>
          <Input bind:value={sessionName} class="grow" name="session-name" aria-label="session name" />
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
