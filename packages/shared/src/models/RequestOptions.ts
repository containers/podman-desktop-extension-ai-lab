export interface FormParamDefinition {
  key: string;
  value: string;
  type: string;
}

export interface RequestOptions {
  url: string;
  method?: string;
  header?: {
    key?: string;
    value?: string;
    system?: boolean;
  }[];
  body?: {
    mode: 'raw' | 'formdata';
    raw?: string;
    formdata?: FormParamDefinition[];
  };
}
