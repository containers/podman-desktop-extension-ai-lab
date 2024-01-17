import * as jsYaml from 'js-yaml';

export interface ContainerConfig {
  name: string;
  contextdir: string;
  containerfile?: string;
  arch: string;
  modelService: boolean;
}
export interface AIConfig {
  application: {
    containers: ContainerConfig[];
  };
}

export function isString(value: unknown): value is string {
  return (value !== undefined && value !== null && typeof value === 'string') || value instanceof String;
}

export function assertString(value: unknown): string {
  if (isString(value)) return value;
  throw new Error('value not a string');
}

export function parseYaml(raw: string, defaultArch: string): AIConfig {
  const aiStudioConfig = jsYaml.load(raw);
  const application = aiStudioConfig?.['application'];
  if (!application) throw new Error('AIConfig has bad formatting.');

  const containers: unknown[] = application['containers'] ?? [];

  return {
    application: {
      containers: containers.map(container => ({
        arch: isString(container['arch']) ? container['arch'] : defaultArch,
        modelService: container['model-service'] === true,
        containerfile: isString(container['containerfile']) ? container['containerfile'] : undefined,
        contextdir: assertString(container['contextdir']),
        name: assertString(container['name']),
      })),
    },
  };
}
