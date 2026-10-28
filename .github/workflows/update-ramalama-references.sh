#!/usr/bin/env bash
#
# Copyright (C) 2025 Red Hat, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

# Script to update ramalama image references in inference-images.json
set -euo pipefail

JSON_PATH="packages/backend/src/assets/inference-images.json"
TMP_JSON="${JSON_PATH}.tmp"

TAG=$1
# Images and their keys in the JSON
# whispercpp is not listed: ramalama stopped building whisper.cpp images after 0.16.0,
# so it stays pinned to the last published digest.
# openvino is not listed: newer ramalama openvino images no longer ship ovms.
IMAGES=(
  "llamacpp:ramalama/ramalama:default"
  "llamacpp:ramalama/cuda:cuda"
  "llamacpp:ramalama/intel-gpu:intel"
)

cp "$JSON_PATH" "$TMP_JSON"

for entry in "${IMAGES[@]}"; do
  IFS=":" read -r key image jsonkey <<< "$entry"
  digest=$(curl -s "https://quay.io/v2/$image/manifests/$TAG"  -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' --head | grep -i Docker-Content-Digest | awk -e '{ print $2 }' | tr -d '\r')
  if [ -z "$digest" ]; then
    echo "Unable to resolve digest for quay.io/$image:$TAG" >&2
    rm -f "$TMP_JSON"
    exit 1
  fi
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
