/** iPadOS can use a desktop Mac user agent; distinguish it by touch support. */
export function isIOSDevice(device: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): boolean {
  return /iPad|iPhone|iPod/i.test(device.userAgent) ||
    (/Mac/i.test(device.platform) && device.maxTouchPoints > 1);
}
