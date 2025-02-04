interface StreamOptions {
  include_usage?: boolean;
}

export interface ModelOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream_options?: StreamOptions;
}
