// podman-desktop-api.d.ts

declare global {
  interface PodmanDesktopApi {
    getState: () => any;
    postMessage: (msg: any) => void;
    setState: (newState: any) => void;
  }

  function acquirePodmanDesktopApi(): PodmanDesktopApi;
}

export {};
