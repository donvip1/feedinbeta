/**
 * Device Fingerprinting Utility
 * Generates a unique device identifier without using external libraries
 * This is used for session tracking similar to TikTok's security model
 */

interface DeviceInfo {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  cookiesEnabled: boolean;
  doNotTrack: string | null;
  colorDepth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  touchSupport: boolean;
}

/**
 * Collect device information for fingerprinting
 */
export function getDeviceInfo(): DeviceInfo {
  const nav = navigator;
  const screen = window.screen;
  
  return {
    userAgent: nav.userAgent,
    language: nav.language,
    platform: nav.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookiesEnabled: nav.cookieEnabled,
    doNotTrack: nav.doNotTrack,
    colorDepth: screen.colorDepth,
    deviceMemory: (nav as any).deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0,
  };
}

/**
 * Generate a simple hash from a string
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a device fingerprint
 * This creates a semi-unique identifier based on device characteristics
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const info = getDeviceInfo();
  const fingerprintData = [
    info.userAgent,
    info.language,
    info.platform,
    info.screenResolution,
    info.timezone,
    String(info.cookiesEnabled),
    info.doNotTrack || '',
    String(info.colorDepth),
    String(info.deviceMemory || ''),
    String(info.hardwareConcurrency || ''),
    String(info.touchSupport),
  ].join('|');
  
  return hashString(fingerprintData);
}

/**
 * Get a shortened device name for display
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  
  // Detect mobile devices
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) return 'Android Phone';
    return 'Android Tablet';
  }
  
  // Detect desktop browsers
  if (/Mac/i.test(ua)) {
    if (/Chrome/i.test(ua)) return 'Chrome on Mac';
    if (/Safari/i.test(ua)) return 'Safari on Mac';
    if (/Firefox/i.test(ua)) return 'Firefox on Mac';
    return 'Mac';
  }
  if (/Windows/i.test(ua)) {
    if (/Chrome/i.test(ua)) return 'Chrome on Windows';
    if (/Firefox/i.test(ua)) return 'Firefox on Windows';
    if (/Edge/i.test(ua)) return 'Edge on Windows';
    return 'Windows PC';
  }
  if (/Linux/i.test(ua)) return 'Linux';
  
  return 'Unknown Device';
}

/**
 * Store device fingerprint in localStorage
 */
export function getStoredFingerprint(): string | null {
  return localStorage.getItem('device_fp');
}

export function storeFingerprint(fingerprint: string): void {
  localStorage.setItem('device_fp', fingerprint);
}

/**
 * Get or generate device fingerprint
 */
export async function getOrCreateFingerprint(): Promise<string> {
  let fingerprint = getStoredFingerprint();
  
  if (!fingerprint) {
    fingerprint = await generateDeviceFingerprint();
    storeFingerprint(fingerprint);
  }
  
  return fingerprint;
}
