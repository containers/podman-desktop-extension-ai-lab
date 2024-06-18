import { beforeEach, test, vi, expect } from 'vitest';
import { WinGPUDetector } from './WinGPUDetector';
import { env } from '@podman-desktop/api';
import WinReg from 'winreg';

/* eslint-disable @typescript-eslint/no-explicit-any */

type WinRegKeys = (err: unknown, registries: WinReg.Registry[] | undefined) => void;
type WinRegValues = (err: unknown, registries: WinReg.RegistryItem[] | undefined) => void;

vi.mock('@podman-desktop/api', () => {
  return {
    env: {
      isWindows: true,
    },
  };
});

// Mock winreg module
vi.mock('winreg', () => {
  const Registry: any = vi.fn();
  Registry.prototype.keys = vi.fn();
  Registry.prototype.values = vi.fn();
  Registry.REG_BINARY = 'REG_BINARY';
  Registry.REG_SZ = 'REG_SZ';
  return { default: Registry };
});

// Reset mocks before each test
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(env).isWindows = true; // Set default to Windows environment
});

test('WinGPUDetector should throw an error on non-windows platform', async () => {
  vi.mocked(env).isWindows = false;

  await expect(new WinGPUDetector().perform()).rejects.toThrowError('incompatible platform');
});

test('getSubkeys should return a list of subkeys', async () => {
  const mockSubkeys = [
    new WinReg({ hive: WinReg.HKLM, key: '\\Subkey1' }),
    new WinReg({ hive: WinReg.HKLM, key: '\\Subkey2' }),
  ];

  vi.mocked(WinReg.prototype.keys).mockImplementation((callback: WinRegKeys) => callback(undefined, mockSubkeys));

  const detector = new WinGPUDetector();
  const subkeys = await detector['getSubkeys']();

  expect(subkeys).toEqual(mockSubkeys);
});

test('getValues should return a list of values for a given subkey', async () => {
  const mockValues = [
    { name: 'HardwareInformation.AdapterString', value: 'GPU Model' },
    { name: 'HardwareInformation.qwMemorySize', value: '40000000' },
  ] as unknown as WinReg.RegistryItem[];

  vi.mocked(WinReg.prototype.values).mockImplementation((callback: WinRegValues) => callback(undefined, mockValues));

  const detector = new WinGPUDetector();
  const values = await detector['getValues'](new WinReg({ hive: WinReg.HKLM, key: '\\Subkey1' }));

  expect(values).toEqual(mockValues);
});

test('extractGpuInfo should return correct IGPUInfo object', () => {
  const mockValues = [
    { name: 'HardwareInformation.AdapterString', value: 'GPU Model', type: 'REG_SZ' },
    { name: 'HardwareInformation.qwMemorySize', value: '40000000' },
  ] as unknown as WinReg.RegistryItem[];

  const detector = new WinGPUDetector();
  const gpuInfo = detector['extractGpuInfo'](mockValues);

  expect(gpuInfo).toEqual({ model: 'GPU Model', vram: 1073741824 }); // 0x40000000 in hex is 1073741824 in decimal
});

test('extractGpuInfo should return undefined if necessary information is missing', () => {
  const mockValues = [{ name: 'SomeOtherValue', value: 'SomeValue' }];

  const detector = new WinGPUDetector();
  const gpuInfo = detector['extractGpuInfo'](mockValues as unknown as WinReg.RegistryItem[]);

  expect(gpuInfo).toBeUndefined();
});

test('getGpuInfoFromSubkey should return IGPUInfo object', async () => {
  const mockSubkey = new WinReg({ hive: WinReg.HKLM, key: '\\Subkey1' });
  const mockValues = [
    { name: 'HardwareInformation.AdapterString', value: 'GPU Model', type: 'REG_SZ' },
    { name: 'HardwareInformation.qwMemorySize', value: '40000000' },
  ] as unknown as WinReg.RegistryItem[];

  vi.mocked(WinReg.prototype.values).mockImplementation((callback: WinRegValues) => callback(undefined, mockValues));

  const detector = new WinGPUDetector();
  const gpuInfo = await detector['getGpuInfoFromSubkey'](mockSubkey);

  expect(gpuInfo).toEqual({ model: 'GPU Model', vram: 1073741824 });
});

test('getGpuInfoFromSubkey should return undefined on error', async () => {
  const mockSubkey = new WinReg({ hive: WinReg.HKLM, key: '\\Subkey1' });

  vi.mocked(WinReg.prototype.values).mockImplementation((callback: WinRegValues) =>
    callback(new Error('test error'), undefined),
  );

  const detector = new WinGPUDetector();
  const gpuInfo = await detector['getGpuInfoFromSubkey'](mockSubkey);

  expect(gpuInfo).toBeUndefined();
});

test('perform should handle errors and return an empty list', async () => {
  vi.mocked(WinReg.prototype.keys).mockImplementationOnce((callback: WinRegKeys) =>
    callback(new Error('test error'), undefined),
  );

  const detector = new WinGPUDetector();

  await expect(detector.perform()).rejects.toThrowError('Failed to get GPU information: Error: test error');
});
