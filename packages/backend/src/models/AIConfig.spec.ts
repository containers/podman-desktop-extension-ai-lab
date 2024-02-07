import { expect, test, describe, vi } from 'vitest';
import fs from 'fs';
import { type AIConfig, parseYamlFile } from './AIConfig';
import path from 'node:path';

// Define mock file paths and contents
const mockYamlPath = 'mock.yml';
const mockYamlContent = `
application:
  containers:
    - name: container1
      contextdir: /path/to/dir1
      arch: ["x86"]
      model-service: true
      gpu-env: ["env1", "env2"]
    - name: container2
      arch: ["arm"]
`;

const readFileSync = vi.spyOn(fs, 'readFileSync');

describe('parseYaml', () => {
  test('should parse valid YAML file', () => {
    readFileSync.mockReturnValue(mockYamlContent);

    const defaultArch = 'x64';
    const expectedConfig: AIConfig = {
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: '/path/to/dir1',
            arch: ['x86'],
            modelService: true,
            gpu_env: ['env1', 'env2'],
          },
          {
            name: 'container2',
            contextdir: path.dirname(mockYamlPath),
            arch: ['arm'],
            modelService: false,
            gpu_env: [],
          },
        ],
      },
    };

    expect(parseYamlFile(mockYamlPath, defaultArch)).toEqual(expectedConfig);
  });

  test('contextdir should be parent directory of yaml file', () => {
    readFileSync.mockReturnValue(mockYamlContent);
    const defaultArch = 'x64';

    const config: AIConfig = parseYamlFile('./path/to/file.yaml', defaultArch);
    expect(config.application.containers).toBeDefined();
    expect(config.application.containers.length).toBe(2);

    const container = config.application.containers[1];
    expect(container.name).toBe('container2');
    expect(container.contextdir).toBeDefined();
    expect(container.contextdir.endsWith('/path/to/')).toBeTruthy();
  });
});
