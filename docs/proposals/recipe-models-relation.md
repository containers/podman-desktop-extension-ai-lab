## Recipes

Currently recipes cannot uses imported models, as they hardcode all models they are compatible with

Example with the chatbot recipe
````json
{
  "id": "chatbot",
  ...
  "categories": [
    "natural-language-processing"
  ],
  "models": [
    "hf.instructlab.granite-7b-lab-GGUF",
    "hf.instructlab.merlinite-7b-lab-GGUF",
    ...
  ]
}
````

We want to find a solution to allow user to use their imported models.

## Models <=> Recipes relation

We discussed earlier, that having a direct relation between models and recipe is 
not the best, as it forces us to hardcode one of them.

The solution would be to introduce a new _element_, which would act as an intermediate.

### E.g.

Models and recipes would define the `backends? | providers? | categories?` they can run on, and the recipe would also define the same. 

Therefore, we would be able to add dynamically models and recipes without having to hardcode anything.

### Problem

**How to name the element linking those**, with https://github.com/containers/podman-desktop-extension-ai-lab/pull/1161 I introduced `InferenceProvider`.

However, currently they are only defined by a name, and this is not really ideal.

Let's say in the future I have several InferenceProviders

- llama-cpp
- llama-cpp-cuda
- llama-cpp-amd
- ollama
- ollama-cuda
- ollama-romc
- whisper-cpp
- whisper-cuda
- whisper-amd

how do I define them ? how recipes and models can indicate that they support one or another ?

For the `llama-cpp*` and `ollama*` they technically are the same logic (llamacpp) they can run `large-language-models`.

Therefore we might use the existing categories ?

Should we implement each InferenceProviders individually ?

Should we add a property to providers to group them ? (tags, labels, implementation)

### Personal

I am having difficulty choosing the right wording to define them.
