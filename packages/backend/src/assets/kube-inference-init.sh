#!/bin/sh

# Environment variables
MODEL_URL="${MODEL_URL}"
MODEL_SHA256="${MODEL_SHA256}"
MODEL_PATH="${MODEL_PATH}"

# Function to calculate the SHA-256 hash of a file
calculate_sha256() {
  sha256sum "$1" | awk '{print $1}'
}

# Function to download the model file
download_model() {
  wget -O "${MODEL_PATH}" "${MODEL_URL}"
}

# Check if the model file exists
if [ -f "${MODEL_PATH}" ]; then
  echo "Model file exists at ${MODEL_PATH}"

  # Calculate the SHA-256 hash of the existing file
  current_sha256=$(calculate_sha256 "${MODEL_PATH}")

  # Check if the SHA-256 hash matches
  if [ "${current_sha256}" = "${MODEL_SHA256}" ]; then
    echo "SHA-256 hash matches"
    exit 0
  else
    echo "SHA-256 hash does not match"
    exit 1
  fi
else
  echo "Model file does not exist at ${MODEL_PATH}. Downloading..."

  # Download the model file
  download_model

  # Calculate the SHA-256 hash of the downloaded file
  downloaded_sha256=$(calculate_sha256 "${MODEL_PATH}")

  # Check if the SHA-256 hash matches
  if [ "${downloaded_sha256}" = "${MODEL_SHA256}" ]; then
    echo "Downloaded model file and SHA-256 hash matches"
    exit 0
  else
    echo "Downloaded model file but SHA-256 hash does not match"
    exit 1
  fi
fi
