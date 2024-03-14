# AI studio

## Installing a released version

If you want to install a specific version of the extension, go to Podman Desktop UI > ⚙ Settings > Extensions > Install a new extension from OCI Image.

The name of the image to use is `ghcr.io/projectatomic/ai-studio:version_to_use`.

You can get released tags for the image at https://github.com/projectatomic/studio-extension/pkgs/container/ai-studio.

The released tags follow the major.minor.patch convention.

If you want to install the last release version, use the latest tag.

## Installing a development version

You can install this extension from Podman Desktop UI > ⚙ Settings > Extensions > Install a new extension from OCI Image.

The name of the image to use is `ghcr.io/projectatomic/ai-studio:nightly`.

You can get earlier tags for the image at https://github.com/projectatomic/studio-extension/pkgs/container/ai-studio.

These images contain development versions of the extension. There is no stable release yet.

## Running in development mode

From the Podman Desktop sources folder:

```
$ yarn watch --extension-folder path-to-extension-sources-folder/packages/backend
```

## Providing a custom catalog

The extension provides a default catalog, but you can build your own catalog by creating a file `$HOME/podman-desktop/ai-studio/catalog.json`.
 
The catalog provides lists of categories, recipes, and models.

Each recipe can belong to one or several categories. Each model can be used by one or several recipes.

The format of the catalog is not stable nor versioned yet, you can see the current catalog's format [in the sources of the extension](https://github.com/projectatomic/studio-extension/blob/main/packages/backend/src/ai.json).

## Packaging sample applications

Sample applications may be added to the catalog. See [packaging guide](PACKAGING-GUIDE.md) for detailed information.

## Feedback

You can provide your feedback on the extension with [this form](https://forms.gle/tctQ4RtZSiMyQr3R8) or create [an issue on this repository](https://github.com/projectatomic/studio-extension/issues).
