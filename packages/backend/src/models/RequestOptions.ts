export interface RequestOptions {
  url: string;
  method?: string;
  header?: {
    key?: string;
    value?: string;
    system?: boolean;
  }[];
  body?: {
    mode: 'raw';
    raw?: string;
  };
}
