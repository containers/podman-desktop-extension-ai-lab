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

If you want to keep the data, you can migrate it by updating certain properties.

### Recipes

The recipe object has a new property `backend` which define which framework is required. 
Value accepted can be `llama-cpp`, `whisper-cpp`, `none`.

Moreover, the `models` property has been changed to `recommended`.

**Example**

```diff
{
  "version": "1.0",
  "recipes": [{
    "id": "chatbot",
    "description" : "This is a Streamlit chat demo application.",
    "name" : "ChatBot",
    "repository": "https://github.com/containers/ai-lab-recipes",
-   "models": [
+   "recommended": [
      "hf.instructlab.granite-7b-lab-GGUF",
       "hf.instructlab.merlinite-7b-lab-GGUF"
    ]
+   "backend": "llama-cpp"
  }],
  "models": [],
  "categories": []
}
```

### Models

The model object has also the new property `backend`, which define which framework is required.
We increase the security by adding a new optional `sha256` property.

**Example**

```diff
{
  "version": "1.0",
  "recipes": [],
  "models": [{
    "id": "hf.instructlab.granite-7b-lab-GGUF",
    "name": "instructlab/granite-7b-lab-GGUF",
    "description": "# InstructLab Granite 7B",
    "hw": "CPU",
    "registry": "Hugging Face",
    "license": "Apache-2.0",
    "url": "https://huggingface.co/instructlab/granite-7b-lab-GGUF/resolve/main/granite-7b-lab-Q4_K_M.gguf",
    "memory": 4080218931,
    "properties": {
      "chatFormat": "openchat"
    },
+   "sha256": "6adeaad8c048b35ea54562c55e454cc32c63118a32c7b8152cf706b290611487",
+   "backend": "llama-cpp"
  }],
  "categories": []
}
```
