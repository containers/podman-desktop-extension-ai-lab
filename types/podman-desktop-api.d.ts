// eslint-disable-next-line etc/no-commented-out-code
// podman-desktop-api.d.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  export interface PodmanDesktopApi {
    getState: () => any;
    postMessage: (msg: any) => void;
    setState: (newState: any) => void;
  }

  function acquirePodmanDesktopApi(): PodmanDesktopApi;
}

export { PodmanDesktopApi };


// TODO: remove when podman desktop API exposes this interface
declare module '@podman-desktop/api' {

  export namespace window {

    export function createWebviewPanel(viewType: string, title: string, options?: WebviewOptions): WebviewPanel;
  }
    export interface Webview {
      /**
       * Content settings for the webview.
       */
      options: WebviewOptions;

      /**
       * HTML contents of the webview.
       *
       * This should be a complete, valid html document. Changing this property causes the webview to be reloaded.
       *
       */
      html: string;

      /**
       * Fired when the webview content posts a message.
       *
       * Webview content can post strings or json serializable objects back to an extension.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readonly onDidReceiveMessage: Event<any>;

      /**
       * Post a message to the webview content.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      postMessage(message: any): Promise<boolean>;

      /**
       * Convert a uri for the local file system to one that can be used inside webviews.
       */
      asWebviewUri(localResource: Uri): Uri;

      /**
       * Content security policy source for webview resources.
       *
       */
      readonly cspSource: string;
    }

    export interface WebviewOptions {
      readonly localResourceRoots?: readonly Uri[];
    }


    interface WebviewPanel {
      /**
       * Identifies the type of the webview panel.
       */
      readonly viewType: string;

      /**
       * Title of the panel shown in UI.
       */
      title: string;

      /**
       * Icon for the panel shown in UI.
       */
      iconPath?:
        | Uri
        | {
            /**
             * The icon path for the light theme.
             */
            readonly light: Uri;
            /**
             * The icon path for the dark theme.
             */
            readonly dark: Uri;
          };

      /**
       * {@linkcode Webview} belonging to the panel.
       */
      readonly webview: Webview;

      /**
       * Whether the panel is active (focused by the user).
       */
      readonly active: boolean;

      /**
       * Whether the panel is visible.
       */
      readonly visible: boolean;

      /**
       * Fired when the panel's view state changes.
       */
      readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>;

      /**
       * Fired when the panel is disposed.
       *
       * This may be because the user closed the panel or because `.dispose()` was
       * called on it.
       *
       * Trying to use the panel after it has been disposed throws an exception.
       */
      readonly onDidDispose: Event<void>;

      /**
       * Show the webview panel.
       * @param preserveFocus When `true`, the webview will not take focus.
       */
      reveal(preserveFocus?: boolean): void;

      /**
       * Dispose of the webview panel.
       *
       * This closes the panel if it showing and disposes of the resources owned by the webview.
       * Webview panels are also disposed when the user closes the webview panel. Both cases
       * fire the `onDispose` event.
       */
      dispose(): void;
    }

  }

