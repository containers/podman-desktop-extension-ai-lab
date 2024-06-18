import { WindowsWorker } from '../WindowsWorker';
import { promisify } from 'node:util';
import type { IGPUInfo } from '@shared/src/models/IGPUInfo';

import WinReg from 'winreg';

// Learn more about the path in https://learn.microsoft.com/fr-fr/windows-hardware/drivers/install/system-defined-device-setup-classes-available-to-vendors
const regKeyPath = '\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}';

export class WinGPUDetector extends WindowsWorker<void, IGPUInfo[]> {
  /**
   * Retrieves the subkeys from the specified registry path.
   * @returns A promise that resolves with an array of WinReg objects representing the subkeys.
   */
  private async getSubkeys(): Promise<WinReg.Registry[]> {
    const regKey = new WinReg({ hive: WinReg.HKLM, key: regKeyPath });
    const listKeys = promisify(regKey.keys).bind(regKey);
    return listKeys();
  }

  /**
   * Retrieves the values for a given subkey.
   * @param subkey - The WinReg object representing the subkey.
   * @returns A promise that resolves with an array of WinReg.RegistryItem objects representing the values.
   */
  private getValues(subkey: WinReg.Registry): Promise<WinReg.RegistryItem[]> {
    const listValues = promisify(subkey.values).bind(subkey);
    return listValues();
  }

  /**
   * This method transform the value to a string, it will convert if required
   * @param item
   * @private
   */
  private getString(item: WinReg.RegistryItem): string {
    switch (item.type) {
      case WinReg.REG_BINARY:
        return Buffer.from(item.value, 'hex').toString('utf16le');
      case WinReg.REG_SZ:
        return item.value;
      default:
        throw new Error(`registry item type not supported (${item.type})`);
    }
  }

  /**
   * Extracts GPU information from registry values.
   * @param values - An array of WinReg.RegistryItem objects representing the registry values.
   * @returns An IGPUInfo object if the necessary information is found; otherwise, undefined.
   */
  private extractGpuInfo(values: WinReg.RegistryItem[]): IGPUInfo | undefined {
    const adapterItem = values.find(item => item.name === 'HardwareInformation.AdapterString');
    if (!adapterItem) return undefined;

    const adapterString = this.getString(adapterItem);
    const memorySize = values.find(item => item.name === 'HardwareInformation.qwMemorySize')?.value;

    if (adapterString) {
      return {
        model: adapterString,
        vram: memorySize ? parseInt(memorySize, 16) : undefined,
      };
    } else {
      console.warn('Necessary GPU information not found.');
      return undefined;
    }
  }

  /**
   * Retrieves GPU information from a given subkey.
   * @param subkey - The WinReg object representing the subkey.
   * @returns A promise that resolves with an IGPUInfo object if successful; otherwise, undefined.
   */
  private async getGpuInfoFromSubkey(subkey: WinReg.Registry): Promise<IGPUInfo | undefined> {
    try {
      const values = await this.getValues(subkey);
      return this.extractGpuInfo(values);
    } catch (error) {
      console.error(`Error processing subkey: ${subkey.key}, error: ${error}`);
      return undefined;
    }
  }

  async perform(): Promise<IGPUInfo[]> {
    if (!this.enabled()) throw new Error('incompatible platform');

    try {
      const subkeys = await this.getSubkeys();

      const reserved = ['\\Properties', '\\Configuration'];
      const filteredSubkeys = subkeys.filter(subkey => reserved.every(key => !subkey.key.endsWith(key)));

      const gpuInfoPromises = filteredSubkeys.map(subkey => this.getGpuInfoFromSubkey(subkey));
      const gpuInfos = await Promise.all(gpuInfoPromises);
      return gpuInfos.filter(info => info !== undefined) as IGPUInfo[];
    } catch (error) {
      throw new Error(`Failed to get GPU information: ${error}`);
    }
  }
}
