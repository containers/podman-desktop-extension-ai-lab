# AI studio

The Podman Desktop AI Studio extension simplifies getting started and developing with AI in a local environment.  It provides key open-source technologies to start building on AI.  A curated catalog of so-called recipes helps navigate the jungle of AI use cases and AI models.  AI Studio further ships playgrounds: environments to experiment with and test AI models, for instance, a chat bot.

## Installation

To install the extension, go to the Podman Desktop UI > ⚙ Settings > Extensions > Install a new extension from OCI Image.

The name of the image to use is `ghcr.io/projectatomic/ai-studio`.  You can get released tags for the image at https://github.com/projectatomic/studio-extension/pkgs/container/ai-studio.

To install a development version, use the `:nightly` tag as shown in the recording below.

![](https://github.com/containers/podman-desktop-media/raw/ai-lab/gifs/installation.gif)

## Running in development mode

From the Podman Desktop sources folder:

```
$ yarn watch --extension-folder path-to-extension-sources-folder/packages/backend
```

## Cleaning up resources 

We'll be adding a way in AI Lab to let a user being able to cleanup the environment: see issue .
For the time being, please consider the following actions:
1. Remove the extension from Podman Desktop, from the Settings > Extensions
2. Remove the running playground environments from the list of Pods
3. Remove the images built by the recipes
4. Remove the containers related to AI
5. Cleanup your local clone of the recipes: `$HOME/podman-desktop/ai-studio`

## Providing a custom catalog

The extension provides a default catalog, but you can build your own catalog by creating a file `$HOME/podman-desktop/ai-studio/catalog.json`.
 
The catalog provides lists of categories, recipes, and models.

Each recipe can belong to one or several categories. Each model can be used by one or several recipes.

The format of the catalog is not stable nor versioned yet, you can see the current catalog's format [in the sources of the extension](https://github.com/projectatomic/studio-extension/blob/main/packages/backend/src/ai.json).

## Packaging sample applications

Sample applications may be added to the catalog. See [packaging guide](PACKAGING-GUIDE.md) for detailed information.


## Feedback

You can provide your feedback on the extension with [this form](https://forms.gle/tctQ4RtZSiMyQr3R8) or create [an issue on this repository](https://github.com/projectatomic/studio-extension/issues).
