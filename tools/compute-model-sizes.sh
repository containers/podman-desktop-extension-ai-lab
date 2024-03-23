echo 'FROM registry.access.redhat.com/ubi9-minimal:9.3' >Containerfile
echo 'RUN microdnf install -y git make g++' >>Containerfile
echo 'RUN git clone https://github.com/ggerganov/llama.cpp' >>Containerfile
echo 'RUN cd llama.cpp && make simple' >>Containerfile
echo 'RUN pwd' >>Containerfile
podman build . -q -t get-model-size
cat packages/backend/src/assets/ai.json | jq -r .models[].url | while read i; do echo $i; curl -s -L -o model $i; podman run --rm -t --security-opt 'label=disable' -v `pwd`/model:/model get-model-size llama.cpp/simple /model a | grep 'model size'; rm model; done
