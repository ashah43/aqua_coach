import { BleManager } from 'react-native-ble-plx';

declare global {
  // eslint-disable-next-line no-var
  var __aquaBleManager__: BleManager | undefined;
}

// Shared BLE manager across screens so a connection can be reused.
// Keep a single instance on globalThis to avoid CBCentralManager re-init assertions.
export const bleManager =
  globalThis.__aquaBleManager__ ??
  new BleManager({
    restoreStateIdentifier: 'com.kaylahall.rowing.ble-restore',
    restoreStateFunction: (restoredState) => {
      console.log('BLE state restored:', {
        connectedDevices: restoredState?.connectedPeripherals?.length ?? 0,
      });
    },
  });

globalThis.__aquaBleManager__ = bleManager;
