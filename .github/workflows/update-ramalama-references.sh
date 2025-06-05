#!/usr/bin/env bash
# Script to update ramalama image references in inference-images.json
set -euo pipefail

JSON_PATH="packages/backend/src/assets/inference-images.json"
TMP_JSON="${JSON_PATH}.tmp"

TAG=$1
# Images and their keys in the JSON
IMAGES=(
  "whispercpp:ramalama/ramalama-whisper-server:default"
  "llamacpp:ramalama/ramalama-llama-server:default"
  "llamacpp:ramalama/cuda-llama-server:cuda"
  "openvino:ramalama/openvino:default"
)

cp "$JSON_PATH" "$TMP_JSON"

for entry in "${IMAGES[@]}"; do
  IFS=":" read -r key image jsonkey <<< "$entry"
  digest=$(curl -s "https://quay.io/v2/$image/manifests/$TAG"  -H 'Accept: application/vnd.oci.image.index.v1+json' --head | grep -i Docker-Content-Digest | awk -e '{ print $2 }' | tr -d '\r')
  # Update the JSON file with the new digest
  jq --arg img "quay.io/$image" --arg dig "$digest" --arg key "$key" --arg jsonkey "$jsonkey" \
    '(.[$key][$jsonkey]) = ($img + "@" + $dig)' \
    "$TMP_JSON" > "$TMP_JSON.new" && mv "$TMP_JSON.new" "$TMP_JSON"
done

# Compare and update if changed
if cmp -s "$JSON_PATH" "$TMP_JSON"; then
  echo "No update needed: digests are up to date."
  rm "$TMP_JSON"
  exit 0
else
  mv "$TMP_JSON" "$JSON_PATH"
  echo "Updated inference-images.json with latest digests."
  exit 10
fi
