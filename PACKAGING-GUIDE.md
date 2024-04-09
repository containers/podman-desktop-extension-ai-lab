# Packaging guide

## ApplicationCatalog

AI Lab uses an internal catalog embedded within the application. This catalog is loaded
by AI Lab and displayed when you access the catalog page.

The format of the catalog is JSON. It is possible for users to have a custom version of
the catalog. In order to do so, copy the file located at https://github.com/containers/podman-desktop-extension-ai-lab/blob/main/packages/backend/src/assets/ai.json to $HOME/podman-desktop/ai-lab/catalog.json and AI Lab will use it instead of the embedded one.
Any change done to this file will also be automatically loaded by AI Lab.

### Format of the catalog file

The catalog file has three main elements: categories, models and recipes. Each of these elements is
represented in the JSON file as an array.

#### Categories

This is the top level construct of the catalog UI. Recipes are grouped into categories. A category
represents the kind of AI application. Although the list of categories provided by default by
AI Lab represents the AI landscape, it is possible to add new categories.

A category has three main attributes: an id (which should be unique among categories), a description
and a name. The category id attribute will then be used to attach a recipe to one or several categories.

#### Models

The catalog also lists the models that may be associated to recipes. A model is also a first class
citizen in AI Lab as they will be listed in the Models page and can be tested through the playground.

A model has the following attributes:
- ```id```: a unique identifier for the model
- ```name```: the model name
- ```description```: a detailed description about the model
- ```hw```: the hardware where the model is compatible. Possible values are CPU and GPU
- ```registry```: the model registry where the model is stored
- ```popularity```: an integer field giving the rating of the model. Can be thought as the number of stars
- ```license```: the license under which the model is available
- ```url```: the URL used to download the model
- ```memory```: the memory footprint of the model in bytes, as computed by the workflow `.github/workflows/compute-model-sizes.yaml`

#### Recipes

A recipe is a sample AI application that is packaged as one or several containers. It is built by AI Lab when the user chooses to download and run it on their workstation. It is provided as
source code and AI Lab will make sure the container images are built prior to launching the containers.

A recipe has the following attributes:
- ```id```: a unique identifier to the recipe
- ```name```: the recipe name
- ```description```: a detailed description about the recipe
- ```repository```: the URL where the recipe code can be retrieved
- ```ref```: an optional ref in the repository to checkout (a branch name, tag name, or commit full id - short commit id won't be recognized). If not defined, the default branch will be used
- ```categories```: an array of category id to be associated by this recipe
- ```basedir```: an optional path within the repository where the ai-lab.yaml file is located. If not provided, the ai-lab.yaml is assumed to be located at the root the repository
- ```readme```: a markdown description of the recipe
- ```models```: an array of model id to be associated with this recipe

#### Recipe configuration file

The configuration file is called ```ai-lab.yaml``` and follows the following syntax.

The root elements are called ```version``` and ```application```.

```version``` represents the version of the specifications that ai-lab adheres to (so far, the only accepted value here is `v1.0`). 

```application``` contains an attribute called ```containers``` whose syntax is an array of objects containing the following attributes:
- ```name```: the name of the container
- ```contextdir```: the context directory used to build the container.
- ```containerfile```: the containerfile used to build the image
- ```model-service```: a boolean flag used to indicate if the container is running the model or not
- ```arch```: an optional array of architecture for which this image is compatible with. The values follow the
[GOARCH specification](https://go.dev/src/go/build/syslist.go)
- ```gpu-env```: an optional array of GPU environment for which this image is compatible with. The only accepted value here is cuda.
- ```ports```: an optional array of ports for which the application listens to.
- `image`: an optional image name to be used when building the container image.

The container that is running the service (having the ```model-service``` flag equal to ```true```) can use at runtime
the model managed by AI Lab through an environment variable ```MODEL_PATH``` whose value is the full path name of the
model file.

Below is given an example of such a configuration file:
```yaml
application:
  containers:
    - name: chatbot-inference-app
      contextdir: ai_applications
      containerfile: builds/Containerfile
    - name: chatbot-model-service
      contextdir: model_services
      containerfile: base/Containerfile
      model-service: true
      arch:
        - arm64
        - amd64
      ports:
        - 8001
      image: quay.io/redhat-et/chatbot-model-service:latest
    - name: chatbot-model-servicecuda
      contextdir: model_services
      containerfile: cuda/Containerfile
      model-service: true 
      gpu-env:
        - cuda
      arch: 
        - amd64
      ports:
        - 8501
      image: quay.io/redhat-et/model_services:latest
```



