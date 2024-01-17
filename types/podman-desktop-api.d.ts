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

  /**
   * Resource identifier for a resource
   */
  export class Uri {
    /**
     * Create an URI from a string, e.g. `http://www.example.com/some/path`,
     * `file:///usr/home`, or `scheme:with/path`.
     *
     * *Note* that for a while uris without a `scheme` were accepted. That is not correct
     * as all uris should have a scheme. To avoid breakage of existing code the optional
     * `strict`-argument has been added. We *strongly* advise to use it, e.g. `Uri.parse('my:uri', true)`
     *
     * @see {@link Uri.toString}
     * @param value The string value of an Uri.
     * @param strict Throw an error when `value` is empty or when no `scheme` can be parsed.
     * @return A new Uri instance.
     */
    static parse(value: string, strict?: boolean): Uri;

    /**
     * Create an URI from a file system path. The {@link Uri.scheme scheme}
     * will be `file`.
     */
    static file(path: string): Uri;

    /**
     * Create a new uri which path is the result of joining
     * the path of the base uri with the provided path segments.
     *
     * @param base An uri. Must have a path.
     * @param pathSegments One more more path fragments
     * @returns A new uri which path is joined with the given fragments
     */
    static joinPath(base: Uri, ...pathSegments: string[]): Uri;

    /**
     * Use the `file` and `parse` factory functions to create new `Uri` objects.
     */
    private constructor(scheme: string, authority: string, path: string, query: string, fragment: string);

    /**
     * Scheme is the `http` part of `http://www.example.com/some/path?query#fragment`.
     * The part before the first colon.
     */
    readonly scheme: string;

    /**
     * Authority is the `www.example.com` part of `http://www.example.com/some/path?query#fragment`.
     * The part between the first double slashes and the next slash.
     */
    readonly authority: string;

    /**
     * Path is the `/some/path` part of `http://www.example.com/some/path?query#fragment`.
     */
    readonly path: string;

    /**
     * The string representing the corresponding file system path of this Uri.
     */
    readonly fsPath: string;

    /**
     * Query is the `query` part of `http://www.example.com/some/path?query#fragment`.
     */
    readonly query: string;

    /**
     * Fragment is the `fragment` part of `http://www.example.com/some/path?query#fragment`.
     */
    readonly fragment: string;

    /**
     * Derive a new Uri from this Uri.
     *
     * ```ts
     * const foo = Uri.parse('http://foo');
     * const httpsFoo = foo.with({ scheme: 'https' });
     * // httpsFoo is now 'https://foo'
     * ```
     *
     * @param change An object that describes a change to this Uri. To unset components use `undefined` or
     *  the empty string.
     * @returns A new Uri that reflects the given change. Will return `this` Uri if the change
     *  is not changing anything.
     */
    with(change: {
      /**
       * The new scheme, defaults to this Uri's scheme.
       */
      scheme?: string;
      /**
       * The new authority, defaults to this Uri's authority.
       */
      authority?: string;
      /**
       * The new path, defaults to this Uri's path.
       */
      path?: string;
      /**
       * The new query, defaults to this Uri's query.
       */
      query?: string;
      /**
       * The new fragment, defaults to this Uri's fragment.
       */
      fragment?: string;
    }): Uri;

    toString(): string;
  }

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

  export namespace containerEngine {
    export function listContainers(): Promise<ContainerInfo[]>;
    export function inspectContainer(engineId: string, id: string): Promise<ContainerInspectInfo>;

    export function createContainer(
      engineId: string,
      containerCreateOptions: ContainerCreateOptions,
    ): Promise<ContainerCreateResult>;
    export function startContainer(engineId: string, id: string): Promise<void>;
    export function logsContainer(
      engineId: string,
      id: string,
      callback: (name: string, data: string) => void,
    ): Promise<void>;
    export function stopContainer(engineId: string, id: string): Promise<void>;
    export function deleteContainer(engineId: string, id: string): Promise<void>;
    export function buildImage(
      containerBuildContextDirectory: string,
      relativeContainerfilePath: string,
      imageName: string,
      platform: string,
      selectedProvider: ProviderContainerConnectionInfo | containerDesktopAPI.ContainerProviderConnection,
      eventCollect: (eventName: 'stream' | 'error' | 'finish', data: string) => void,
      abortController?: AbortController,
    );
    export function saveImage(engineId: string, id: string, filename: string): Promise<void>;
    export function listImages(): Promise<ImageInfo[]>;
    export function tagImage(engineId: string, imageId: string, repo: string, tag?: string): Promise<void>;
    export function pushImage(
      engineId: string,
      imageId: string,
      callback: (name: string, data: string) => void,
      authInfo?: ContainerAuthInfo,
    ): Promise<void>;

    export function pullImage(
      containerProviderConnection: ContainerProviderConnection,
      imageName: string,
      callback: (event: PullEvent) => void,
    ): Promise<void>;
    export function deleteImage(engineId: string, id: string): Promise<void>;

    export function info(engineId: string): Promise<ContainerEngineInfo>;
    export const onEvent: Event<ContainerJSONEvent>;

    export function listNetworks(): Promise<NetworkInspectInfo[]>;
    export function createNetwork(
      containerProviderConnection: ContainerProviderConnection,
      networkCreateOptions: NetworkCreateOptions,
    ): Promise<NetworkCreateResult>;
  }

  export interface ExtensionContext {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly subscriptions: { dispose(): any }[];

    /**
     * An absolute file path in which the extension can store state.
     * The directory might not exist on disk and creation is
     * up to the extension.
     */
    readonly storagePath: string;

    /**
     * The uri of the directory containing the extension.
     */
    readonly extensionUri: Uri;
  }

  

}

