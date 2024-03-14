export interface RequestOptions {
  url: string;
  method?: string;
  body: {
    mode: 'raw';
    raw?: string;
  }
}
