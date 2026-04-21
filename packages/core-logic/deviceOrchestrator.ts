/**
 * DeviceOrchestrator — Multi-device session synchronization
 * Phase 4: Distributed Mesh & Edge Routing
 *
 * Keeps linked devices in sync: same user can connect from multiple
 * devices and see consistent state. Uses Socket.IO for real-time
 * propagation and delta-based state diffs.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '@packages/utils/logger.js';

export interface LinkedDevice {
  deviceId: string;
  userId: string;
  deviceType: 'web' | 'mobile' | 'paios' | 'cli' | 'tablet';
  sessionId: string;
  connectedAt: number;
  lastActivity: number;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export interface DeviceStateUpdate {
  userId: string;
  sourceDeviceId: string;
  key: string;
  value: unknown;
  version: number;
  timestamp: number;
}

export class DeviceOrchestrator extends EventEmitter {
  private devices = new Map<string, LinkedDevice>();
  private userDeviceIndex = new Map<string, Set<string>>();  // userId → Set<deviceId>
  private stateVersions = new Map<string, number>();         // "userId:key" → version

  /** Register a device */
  linkDevice(device: LinkedDevice): void {
    this.devices.set(device.deviceId, device);

    if (!this.userDeviceIndex.has(device.userId)) {
      this.userDeviceIndex.set(device.userId, new Set());
    }
    this.userDeviceIndex.get(device.userId)!.add(device.deviceId);

    logInfo('DeviceOrchestrator', `Device linked: ${device.deviceId} (${device.deviceType}) for user ${device.userId}`);
    this.emit('device:linked', device);
  }

  /** Unlink a device */
  unlinkDevice(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (!device) return;

    this.devices.delete(deviceId);
    const userDevices = this.userDeviceIndex.get(device.userId);
    if (userDevices) {
      userDevices.delete(deviceId);
      if (userDevices.size === 0) {
        this.userDeviceIndex.delete(device.userId);
      }
    }

    logInfo('DeviceOrchestrator', `Device unlinked: ${deviceId}`);
    this.emit('device:unlinked', device);
  }

  /** Get all devices for a user */
  getUserDevices(userId: string): LinkedDevice[] {
    const ids = this.userDeviceIndex.get(userId);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.devices.get(id))
      .filter((d): d is LinkedDevice => d !== undefined);
  }

  /** Propagate a state update to all of a user's other devices */
  propagateStateUpdate(update: DeviceStateUpdate): void {
    const versionKey = `${update.userId}:${update.key}`;
    const currentVersion = this.stateVersions.get(versionKey) ?? 0;

    if (update.version <= currentVersion) {
      logWarn('DeviceOrchestrator', `Stale update ignored: ${versionKey} v${update.version} <= v${currentVersion}`);
      return;
    }

    this.stateVersions.set(versionKey, update.version);

    const otherDevices = this.getUserDevices(update.userId)
      .filter(d => d.deviceId !== update.sourceDeviceId);

    for (const device of otherDevices) {
      this.emit('device:state_update', {
        targetDeviceId: device.deviceId,
        update,
      });
    }

    logInfo('DeviceOrchestrator', `State update ${update.key} v${update.version} propagated to ${otherDevices.length} devices`);
  }

  /** Touch device activity */
  touchDevice(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.lastActivity = Date.now();
    }
  }

  /** Get next version for a state key */
  nextVersion(userId: string, key: string): number {
    const versionKey = `${userId}:${key}`;
    const current = this.stateVersions.get(versionKey) ?? 0;
    return current + 1;
  }

  /** List all connected devices */
  listAllDevices(): LinkedDevice[] {
    return Array.from(this.devices.values());
  }

  /** Get device count per user */
  getStats(): { totalDevices: number; totalUsers: number } {
    return {
      totalDevices: this.devices.size,
      totalUsers: this.userDeviceIndex.size,
    };
  }
}

/** Singleton */
export const deviceOrchestrator = new DeviceOrchestrator();

