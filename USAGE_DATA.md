# Data Collection

The AI Lab extension uses telemetry to collect anonymous usage data in order to identify issues and improve our user experience. You can read our privacy statement
[here](https://developers.redhat.com/article/tool-data-collection).

Telemetry for the extension is based on the Podman Desktop telemetry.

Users are prompted during Podman Desktop first startup to accept or decline telemetry. This setting can be
changed at any time in Settings > Preferences > Telemetry.

On disk the setting is stored in the `"telemetry.*"` keys within the settings file,
at `$HOME/.local/share/containers/podman-desktop/configuration/settings.json`. A generated anonymous id
is stored at `$HOME/.redhat/anonymousId`.

## What's included in the telemetry data

- General information, including operating system, machine architecture, and country.
- When the extension starts and stops.
- When the icon to enter the extension zone is clicked.
- When a recipe page is opened (with recipe Id and name).
- When a sample application is pulled (with recipe Id and name).
- When a playground is started or stopped (with model Id).
- When a request is sent to a model in the playground (with model Id, **without** request content).
- When a model is downloaded or deleted from disk.

No personally identifiable information is captured. An anonymous id is used so that we can correlate the actions of a user even if we can't tell who they are.
