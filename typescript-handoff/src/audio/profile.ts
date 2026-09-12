/**
 * The master profile. Headphones take the wide profile with full stereo and the low drones
 * intact. Laptop speakers take the narrow profile, which folds the widener, raises the low
 * shelf under the drones, and trims their level so nothing turns into buzz.
 */
export type OutputProfile = 'wide' | 'narrow';

const HEADPHONE = /head|ear|bud|pod|hp\b|iem/i;

export async function detectOutputProfile(): Promise<OutputProfile> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return 'narrow';
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter((d) => d.kind === 'audiooutput');
    const chosen = outputs.find((d) => d.deviceId === 'default') ?? outputs[0];
    if (chosen?.label && HEADPHONE.test(chosen.label)) return 'wide';
    return 'narrow';
  } catch { return 'narrow'; }
}

export interface ProfileSettings { widener: number; droneTrimDb: number; lowCutHz: number }
export function profileSettings(p: OutputProfile): ProfileSettings {
  return p === 'wide' ? { widener: 0.6, droneTrimDb: 0, lowCutHz: 20 } : { widener: 0.15, droneTrimDb: -8, lowCutHz: 70 };
}
