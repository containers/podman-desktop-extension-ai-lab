# AI Lab

The Podman Desktop AI Lab extension simplifies getting started and developing with AI in a local environment.  It provides key open-source technologies to start building on AI.  A curated catalog of so-called recipes helps navigate the jungle of AI use cases and AI models. AI Lab further ships playgrounds: environments to experiment with and test AI models, for instance, a chat bot.



## Topics
- [Technology](#technology)
- [Extension features](#extension-features)
- [Requirements](#requiremements)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [Feedback](#feedback)



## Technology

The AI Lab extensions uses [Podman](https://podman.io) machines to run inference servers for LLM models and AI applications.
The AI models can be downloaded, and common formats like [GGUF](https://github.com/ggerganov/ggml/blob/master/docs/gguf.md), [Pytorch](https://pytorch.org) or [Tensorflow](https://www.tensorflow.org) are supported.

## Extension features

### AI Models

AI Lab provides a curated list of open source AI models and LLMs. Once downloaded, the models are available to be used for AI applications, model services and playgrounds.

#### Model services

Once a model is downloaded, a model service can be started. A model service is an inference server that is running in a container and exposing the model through the well-known chat API common to many providers.

#### Playgrounds

The integrated Playground environments allow for experimenting with available models in a local environment. An intuitive user prompt helps in exploring the capabilities and accuracy of various models and aids in finding the best model for the use case at hand. The Playground interface further allows for parameterizing models to further optimize the settings and attributes of each model.

### AI applications

Once an AI model is available through a well known endpoint, it's easy to imagine a new world of applications that will connect and use the AI model. AI Lab support AI applications as a set of containers that are connected together. 

AI Lab ships with a so-called Recipes Catalog that helps you navigate a number of core AI use cases and problem domains such as Chat Bots, Code Generators and Text Summarizers. Each recipe comes with detailed explanations and sample applications that can be run with various large language models (LLMs). Experimenting with multiple models allows finding the optimal one for your use case.

## Requirements

Disclaimer: This is **EXPERIMENTAL** and all features are subject to change as we develop the extension.

### Requirement 1. Software and hardware requirements

**OS:**

Compatible on Windows, macOS & Linux

**Software:**

- [Podman Desktop 1.8.0+](https://github.com/containers/podman-desktop)
- [Podman 4.9.0+](https://github.com/containers/podman)

**Hardware**

LLMs AI models are heavy resource consumers both in terms of memory and CPU. Each of the provided models consumes about 4GiB of memory and requires at least 4 CPUs to run.

So we recommend that a minimum of 12GB of memory and at least 4 CPUs for the Podman machine.

As an additional recommended practice, do nor run more than 3 simultaneous models concurrently.

Please note that this is not relevant for WSL on Windows as the WSL technology the memory and CPU with the host desktop. 

## Installation

To install the extension, go to the Podman Desktop UI > ⚙ Settings > Extensions > Install a new extension from OCI Image.

The name of the image to use is `ghcr.io/containers/podman-desktop-extension-ai-lab`.  You can get released tags for the image at https://github.com/containers/podman-desktop-extension-ai-lab/pkgs/container/podman-desktop-extension-ai-lab.

To install a development version, use the `:nightly` tag as shown in the recording below.

![](https://github.com/containers/podman-desktop-media/raw/ai-lab/gifs/installation.gif)

## Usage

1. **Download a model**

Let's select a model from the catalog and download it locally to our workstation.

[![](/docs/img/download-model.gif)](https://github.com/containers/podman-desktop-media/raw/ai-lab/videos/download-model.mp4)

2. **Start an inference server**

Once a model is available locally, let's start an inference server

[![](/docs/img/start-inference-server.gif)](https://github.com/containers/podman-desktop-media/raw/ai-lab/videos/start-inference-server.mp4)

3. **Start a playground to have a chat conversation with model**

[![](/docs/img/playground.gif)](https://github.com/containers/podman-desktop-media/raw/ai-lab/videos/playground.mp4)

4. **Start a AI application and use it from the browser**

[![](/docs/img/start-ai-app.gif)](https://github.com/containers/podman-desktop-media/raw/ai-lab/videos/start-ai-app.mp4)

## Contributing

Want to help develop and contribute to the AI Lab extension?

You can use `yarn watch --extension-folder` from the Podman Desktop directory to automatically rebuild and test the AI Lab extension:

```sh
git clone https://github.com/containers/podman-desktop
git clone https://github.com/containers/podman-desktop-extension-ai-lab
cd podman-desktop-extension-ai-lab
yarn install
yarn build
cd ../podman-desktop
yarn watch --extension-folder ../podman-desktop-extension-ai-lab/packages/backend
```

If you are live editing the frontend package, from packages/frontend folder:

```
$ yarn watch
```

### Cleaning up resources 

We'll be adding a way in AI Lab to let a user cleanup the environment: see issue https://github.com/containers/podman-desktop-extension-ai-lab/issues/469.
For the time being, please consider the following actions:
1. Remove the extension from Podman Desktop, from the Settings > Extensions
2. Remove the running playground environments from the list of Pods
3. Remove the images built by the recipes
4. Remove the containers related to AI
5. Cleanup your local clone of the recipes: `$HOME/podman-desktop/ai-lab`

### Providing a custom catalog

The extension provides a default catalog, but you can build your own catalog by creating a file `$HOME/podman-desktop/ai-lab/catalog.json`.

The catalog provides lists of categories, recipes, and models.

Each recipe can belong to one or several categories. Each model can be used by one or several recipes.

The format of the catalog is not stable nor versioned yet, you can see the current catalog's format [in the sources of the extension](https://github.com/containers/podman-desktop-extension-ai-lab/blob/main/packages/backend/src/assets/ai.json).

### Packaging sample applications

Sample applications may be added to the catalog. See [packaging guide](PACKAGING-GUIDE.md) for detailed information.


## Feedback

You can provide your feedback on the extension with [this form](https://forms.gle/tctQ4RtZSiMyQr3R8) or create [an issue on this repository](https://github.com/containers/podman-desktop-extension-ai-lab/issues).
