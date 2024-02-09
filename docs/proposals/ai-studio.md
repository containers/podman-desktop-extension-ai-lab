# Motivation

Today, there is no notion of ordering between the containers. But we know that we have a dependency between
the client application and the container that is running the model.

The second issue is that there is no concept of starting point for a container so today we rely only on the
container being started by the container engine and we know that this is not adequate for the model service container

So this is handle by a kind of dirty fix: the containers are all started in parallel but as the client application
will fail because the model service is started (as it take a while), so we are trying to restart the client application
until the model service is properly started.

The purpose of this change is to propose an update to the ai-studio.yaml so that it is as much generic as it
could be and inspired from the Compose specification.

## Proposed changes

Define a dependency between containers: so in the definition of container, we would add a new ```depends``` field
that would define the ordering between the containers. This would be an optional field.

Define a condition for the container to be properly started: this would be based on the HEALTHCHECK that can already
be defined in a Dockerfile. In the first iteration, we would support only the ```test``` field. If ```healthcheck``` is defined,
then we would check for the healthcheck status field to be ```healthy```

So the current chatbot file would be updated from:

```yaml
application:
  type: language
  name: chatbot
  description: This is a LLM chatbot application that can interact with a llamacpp model-service
  containers:
    - name: chatbot-inference-app
      contextdir: ai_applications
      containerfile: builds/Containerfile
    - name: chatbot-model-service
      contextdir: model_services
      containerfile: base/Containerfile
      model-service: true
      backend: 
        - llama
      arch:
        - arm64
        - amd64
    - name: chatbot-model-servicecuda
      contextdir: model_services
      containerfile: cuda/Containerfile
      model-service: true 
      backend: 
        - llama
      gpu-env:
        - cuda
      arch: 
        - amd64
```

to

```yaml
application:
  type: language
  name: chatbot
  description: This is a LLM chatbot application that can interact with a llamacpp model-service
  containers:
    - name: chatbot-inference-app
      contextdir: ai_applications
      containerfile: builds/Containerfile
      depends:                     # added
        - chatbot-model-service    # added
    - name: chatbot-model-service
      contextdir: model_services
      containerfile: base/Containerfile
      model-service: true
      healthcheck:                               # added
        test: curl -f localhost:7860 || exit 1   # added
      backend: 
        - llama
      arch:
        - arm64
        - amd64
    - name: chatbot-model-service
      contextdir: model_services
      containerfile: cuda/Containerfile
      model-service: true
      healthcheck:                              # added
        test: curl -f localhost:7860 || exit 1  # added
      backend: 
        - llama
      gpu-env:
        - cuda
      arch: 
        - amd64
```

From the Podman Desktop API point of view, this would require extending the
[ContainerCreateOptions](https://podman-desktop.io/api/interfaces/ContainerCreateOptions) structure to support the
HealthCheck option.
