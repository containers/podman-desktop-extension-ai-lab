<script lang="ts">
import { router } from 'tinro';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { studioClient } from '/@/utils/client';
import DashboardBanner from '/@/lib/images/DashboardBanner.svelte';
import { Button, NavPage } from '@podman-desktop/ui-svelte';

const openRecipesCatalog = () => {
  router.goto('/recipes');
};

const openModelsPage = () => {
  router.goto('/models');
};

const openPlaygroundsPage = () => {
  router.goto('/playgrounds');
};

const openServicesPage = () => {
  router.goto('/services');
};

const openGithub = () => {
  studioClient.openURL('https://github.com/containers/podman-desktop-extension-ai-lab');
};

const openIssuesPage = () => {
  studioClient.openURL('https://github.com/containers/podman-desktop-extension-ai-lab/issues');
};

const openDiscussionsPage = () => {
  studioClient.openURL('https://github.com/containers/podman-desktop/discussions');
};
</script>

<NavPage title="Welcome to Podman AI Lab" searchEnabled="{false}">
  <svelte:fragment slot="additional-actions">
    <Button type="secondary" title="Open GitHub repository" on:click="{openGithub}" icon="{faGithub}">Github</Button>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div slot="content" class="flex flex-col min-w-full min-h-full text-[var(--pd-details-body-text)]">
      <div class="mt-4 px-5 space-y-5" aria-label="inner-content">
        <DashboardBanner class="rounded-md my-2 w-full" />
        <p>
          Podman AI Lab is an open source extension for Podman Desktop to work with LLMs (Large Language Models) on a
          local environment. It provides key open-source technologies to start building on AI. A curated catalog of
          so-called recipes helps navigate the jungle of AI use cases and AI models. AI Lab further ships playgrounds:
          environments to experiment with and test AI models, for instance, a chat bot.
        </p>

        <h1 class="text-xl first-letter:uppercase underline">Recipes Catalog</h1>
        <p>
          Podman AI Lab ships with a so-called
          <button class="underline" title="Open the Recipes Catalog page" on:click="{openRecipesCatalog}"
            >Recipes Catalog</button>
          that helps you navigate a number of core AI use cases and problem domains such as Chat Bots, Code Generators and
          Text Summarizers. Each recipe comes with detailed explanations and sample applications that can be run with various
          large language models (LLMs). Experimenting with multiple models allows finding the optimal one for your use case.
        </p>

        <h1 class="text-xl first-letter:uppercase underline">AI Models</h1>
        <p>
          Podman AI Lab provides a curated list of open source
          <button class="underline" title="Open the Models page" on:click="{openModelsPage}">AI Models and LLMs</button
          >. Once downloaded, the models are available to be used for AI applications, model services and playgrounds.
        </p>

        <h1 class="text-xl first-letter:uppercase underline">Model Serving</h1>
        <p>
          Once a model has been downloaded, you can start an inference server for the model. This allows to test the
          model using a playground environment or to connect applications as the inference server is exposing a well
          know chat API.
        </p>

        <h1 class="text-xl first-letter:uppercase underline">Playgrounds</h1>
        <p>
          The integrated
          <button class="underline" title="Open the Playgrounds page" on:click="{openPlaygroundsPage}"
            >Playground environments</button>
          allow for experimenting with available models in a local environment. An intuitive user prompt helps in exploring
          the capabilities and accuracy of various models and aids in finding the best model for the use case at hand.
        </p>
        <p>
          Once started, each playground ships with a generic chat client to interact with the model service. The <button
            class="underline"
            title="Open the Services page"
            on:click="{openServicesPage}">Services</button>
          page allows for accessing running model services and provides further details and code snippets to interact with
          them.
        </p>

        <h1 class="text-xl first-letter:uppercase underline">Feedback</h1>
        <p>
          If you discover an issue or want to request a new feature, you can open an issue
          <button class="underline" title="Open the issues page" on:click="{openIssuesPage}">here</button>.
        </p>
        <p>
          If you want to get more information about this project or exchange with the community, you can start a
          discussion
          <button class="underline" title="Open the discussions page" on:click="{openDiscussionsPage}">here</button>.
        </p>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
