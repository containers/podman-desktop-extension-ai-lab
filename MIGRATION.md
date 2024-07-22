# Migration guide

## ApplicationCatalog

Before **Podman AI Lab** `v1.2.0` the [user-catalog](./PACKAGING-GUIDE.md#applicationcatalog) were not versioned. 
Starting from `v1.2.0` all user-catalog require to have a `version` property.

The list of catalog versions can be found in [packages/backend/src/utils/catalogUtils.ts](https://github.com/containers/podman-desktop-extension-ai-lab/blob/main/packages/backend/src/utils/catalogUtils.ts)

The catalog has its own version number, as we may not require to update it with every update. It will follow semantic versioning convention.

## `None` to Catalog `1.0`

`None` represents any catalog version prior to the first versioning. 

Version `1.0` of the catalog adds an important property to models `backend`, defining the type of framework required by the model to run (E.g. LLamaCPP, WhisperCPP).

### Changelog

- property `backend` on models and recipes. Ref https://github.com/containers/podman-desktop-extension-ai-lab/pull/1186
- property `models` is now **deprecated** and useless. Ref https://github.com/containers/podman-desktop-extension-ai-lab/pull/1210
- property `recommended` has been added. Ref https://github.com/containers/podman-desktop-extension-ai-lab/pull/1210
- optional `chatFormat` added. Ref: https://github.com/containers/podman-desktop-extension-ai-lab/pull/868
- optional `sha256` property on models. Ref https://github.com/containers/podman-desktop-extension-ai-lab/pull/1078

