declare module 'postman-code-generators' {
  import type { Request } from 'postman-collection';

  export function getLanguageList(): Language[];

  export interface Language {
    key: string;
    label: string;
    syntax_mode: string;
    variants: LanguageVariant[],
  }

  export interface LanguageVariant {
    key: string;
  }

  export function getOptions(language: string, variant: string, callback: (error: unknown, options: Option[]) => void): void;

  export interface Option {
    name: string;
    id: string;
    type: string;
    default: string | number | boolean;
    description: string;
  }

  export function convert(language: string, variant: string, request: Request, options: Record<string, string | number | boolean>, callback: (error: unknown, snippet: string | undefined) => void): void;
}
