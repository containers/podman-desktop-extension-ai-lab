# Migration guide

## ℹ️ ApplicationCatalog

Before **Podman AI Lab** `v1.2.0` the [user-catalog](./PACKAGING-GUIDE.md#applicationcatalog) was not versioned.
Starting from `v1.2.0` the user-catalog require to have a `version` property.

> [!NOTE]
> The `user-catalog.json` file can be found in `~/.local/share/containers/podman-desktop/extensions-storage/redhat.ai-lab`.

The list of catalog versions can be found in [packages/backend/src/utils/catalogUtils.ts](https://github.com/containers/podman-desktop-extension-ai-lab/blob/main/packages/backend/src/utils/catalogUtils.ts)

The catalog has its own version number, as we may not require to update it with every update. It will follow semantic versioning convention.

## `None` to Catalog `1.0`

`None` represents any catalog version prior to the first versioning.

Version `1.0` of the catalog adds an important property to models `backend`, defining the type of framework required by the model to run (E.g. LLamaCPP, WhisperCPP).

### 🛠️ How to migrate

You can either delete any existing `user-catalog` by deleting the `~/.local/share/containers/podman-desktop/extensions-storage/redhat.ai-lab/user-catalog.json`.

> [!WARNING]
> This will remove the models you have imported from the catalog. You will be able to import it again afterward.

If you want to keep the data, you can migrate it by updating certain properties within the recipes and models fields.

### Recipes

The recipe object has a new property `backend` which defines which framework is required.
Value accepted are `llama-cpp`, `whisper-cpp` and `none`.

Moreover, the `models` property has been changed to `recommended`.

> [!TIP]
> Before Podman AI Lab version v1.2 recipes uses the `models` property to list the models compatible. Now all models using the same `backend` could be used. We introduced `recommended` to highlight certain models.

### Models

The model object has also the new property `backend`, which defines which framework is required.
Additionally, we have enhanced security by introducing a new optional `sha256` property.

> [!TIP]
> To get the sha256 of a model, you can use the `sha256sum [model-file]` command in a terminal.
