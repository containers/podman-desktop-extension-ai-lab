# Podman AI Lab

Podman AI Lab is an open source extension for Podman Desktop to work with LLMs (Large Language Models) on a local environment. Featuring a recipe catalog with common AI use cases, a curated set of open source models, and a playground for learning, prototyping and experimentation, Podman AI Lab helps you to quickly and easily get started bringing AI into your applications, without depending on infrastructure beyond your laptop ensuring data privacy and security.


## Topics
- [Technology](#technology)
- [Extension features](#extension-features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [Feedback](#feedback)



## Technology

Podman AI Lab uses [Podman](https://podman.io) machines to run inference servers for LLM models and AI applications.
The AI models can be downloaded, and common formats like [GGUF](https://github.com/ggerganov/ggml/blob/master/docs/gguf.md), [Pytorch](https://pytorch.org) or [Tensorflow](https://www.tensorflow.org) are supported.

## Extension features

### AI Models

Podman AI Lab provides a curated list of open source AI models and LLMs. Once downloaded, the models are available to be used for AI applications, model services and playgrounds.

#### Model services

Once a model is downloaded, a model service can be started. A model service is an inference server that is running in a container and exposing the model through the well-known chat API common to many providers.

#### Playgrounds

The integrated Playground environments allow for experimenting with available models in a local environment. An intuitive user prompt helps in exploring the capabilities and accuracy of various models and aids in finding the best model for the use case at hand. The Playground interface further allows for parameterizing models to further optimize the settings and attributes of each model.

### AI applications

Once an AI model is available through a well known endpoint, it's easy to imagine a new world of applications that will connect and use the AI model. Podman AI Lab supports AI applications as a set of containers that are connected together. 

Podman AI Lab ships with a so-called Recipes Catalog that helps you navigate a number of core AI use cases and problem domains such as Chat Bots, Code Generators and Text Summarizers. Each recipe comes with detailed explanations and sample applications that can be run with various large language models (LLMs). Experimenting with multiple models allows finding the optimal one for your use case.

## Requirements

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

You can install the Podman AI Lab extension directly inside of Podman Desktop.

Go to Extensions > Catalog > Install Podman AI Lab.

![](https://github.com/containers/podman-desktop-media/raw/ai-lab/gifs/install_ai_lab.gif)

To install a development version, use the `Install custom...` action as shown in the recording below.

The name of the image to use is `ghcr.io/containers/podman-desktop-extension-ai-lab`. You can get released tags for the image at https://github.com/containers/podman-desktop-extension-ai-lab/pkgs/container/podman-desktop-extension-ai-lab.

![](https://github.com/containers/podman-desktop-media/raw/ai-lab/gifs/install_development_version.gif)

## Usage

1. **Download a model**

Let's select a model from the catalog and download it locally to our workstation.

![](https://github.com/containers/podman-desktop-media/raw/ai-lab/gifs/download-model.gif)

2. **Start an inference server**

Once a model is available locally, let's start an inference server

![](https://github.com/containers/podman-desktop-media/raw/ai-lab/gifs/start-inference-server.gif)

3. **Start a playground to have a chat conversation with model**

![](https://github.com/containers/podman-desktop-media/raw/ai-lab/gifs/playground.gif)

4. **Start a AI application and use it from the browser**

![](https://github.com/containers/podman-desktop-media/raw/ai-lab/gifs/start-ai-app.gif)

## Contributing

Want to help develop and contribute to Podman AI Lab?

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

We'll be adding a way to let a user cleanup their environment: see issue https://github.com/containers/podman-desktop-extension-ai-lab/issues/469.
For the time being, please consider the following actions:
1. Remove the extension from Podman Desktop, from the Settings > Extensions
2. Remove the running playground environments from the list of Pods
3. Remove the images built by the recipes
4. Remove the containers related to AI
5. Cleanup your local clone of the recipes: `$HOME/podman-desktop/ai-lab`

### 📖 Providing a custom catalog

The extension provides by default a curated list of recipes, models and categories. However, this system is extensible and you can define your own.

To enhance the existing catalog, you can create a file located in the extension storage folder `$HOME/.local/share/containers/podman-desktop/extensions-storage/redhat.ai-lab/user-catalog.json`.

It must follow the same format as the default catalog [in the sources of the extension](https://github.com/containers/podman-desktop-extension-ai-lab/blob/main/packages/backend/src/assets/ai.json). 

> :information_source: The default behaviour is to append the items of the user's catalog to the default one.

> :warning: Each item (recipes, models or categories) has a unique id, when conflict between the default catalog and the user one are found, the user's items overwrite the defaults.

### Packaging sample applications

Sample applications may be added to the catalog. See [packaging guide](https://github.com/containers/podman-desktop-extension-ai-lab/blob/main/PACKAGING-GUIDE.md) for detailed information.

## Roadmap

The roadmap is always open and we are looking for your feedback. Please create new issues and upvote on the issues that are feeling the most important for you. 

We will be working on the following items:
- **Expanded Recipes**: Discover new use cases and samples to inspire and accelerate your applications. 
- **GPU Acceleration**: Speeding up processing times by leveraging GPU acceleration.
- **API/CLI**: Interact with Podman AI Lab from CLI and APIs.
- **Enhanced Playgrounds**: Streamlined workflows and UX giving a better space to experiment with LLMs and quickly iterate.
- **Fine Tuning with [InstructLab](https://instructlab.ai/)**: Re-train LLMs with a set of taxonomy knowledges. Learn more about [the InstructLab project](https://github.com/instructlab).
- **Enable Function Calling**: Use LLMs to retrieve or interact with external tool by doing API calls.
- **Local RAG**: Explore RAG pattern, load your document and test behavior of the model.
- **Bridge with AI Platforms (incl. K8s)**: Connect to remote models and ease deployment of applications.

## Feedback

You can provide your feedback on the extension with [this form](https://forms.gle/tctQ4RtZSiMyQr3R8) or create [an issue on this repository](https://github.com/containers/podman-desktop-extension-ai-lab/issues).
