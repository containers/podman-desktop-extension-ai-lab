#
# Copyright (C) 2024 Red Hat, Inc.
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

FROM registry.access.redhat.com/ubi10/nodejs-24-minimal:1791463197@sha256:498ccfc43f6fe349a4d87db6af6d83ab420e9450f3800140cdc90c290dcd462f AS builder

WORKDIR /opt/app-root/src

# pnpm runs an implicit dependency check before `run` scripts, which spawns a
# nested `pnpm install`. Setting CI here rather than per-RUN makes every pnpm
# invocation non-interactive, otherwise that nested install blocks on a prompt.
ENV CI=true

COPY --chown=1001:1001 . .

RUN npm i -g corepack@0.36.0 && corepack enable

RUN pnpm install
RUN pnpm build

# Assemble the extension layout, so the final stage is a single COPY
RUN mkdir -p /opt/app-root/extension/api
RUN cp -r packages/backend/dist /opt/app-root/extension/
RUN cp packages/backend/package.json /opt/app-root/extension/
RUN cp -r packages/backend/media /opt/app-root/extension/
RUN cp packages/backend/icon.png /opt/app-root/extension/
RUN cp packages/backend/brain.woff2 /opt/app-root/extension/
RUN cp LICENSE /opt/app-root/extension/
RUN cp README.md /opt/app-root/extension/
RUN cp api/openapi.yaml /opt/app-root/extension/api/

FROM scratch

COPY --from=builder /opt/app-root/extension /extension

LABEL org.opencontainers.image.title="AI Lab" \
        org.opencontainers.image.description="AI Lab" \
        org.opencontainers.image.vendor="Red Hat" \
        io.podman-desktop.api.version=">= 1.8.0"
