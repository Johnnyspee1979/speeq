/**
 * ShareService — deel borgingspunten via WhatsApp, Email of link.
 * Geen bibliotheek nodig — werkt via native Web Share API + WhatsApp deeplink.
 */

import { Platform } from 'react-native';

export interface SharePayload {
  projectId: string;
  taskTitle: string;
  inspectionPointId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  weatherLabel?: string | null;
  userName?: string | null;
  evidenceId?: string;
}

function buildShareText(p: SharePayload): string {
  const lines = [
    `📸 *Borgingspunt vastgelegd*`,
    ``,
    `🏗️ Project: ${p.projectId}`,
    `📐 ${p.taskTitle}`,
    `🔖 ${p.inspectionPointId}`,
    `📍 GPS: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`,
    `🕐 ${new Date(p.timestamp).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}`,
  ];

  if (p.weatherLabel) lines.push(`🌤️ ${p.weatherLabel}`);
  if (p.userName)     lines.push(`👷 ${p.userName}`);

  return lines.join('\n');
}

/** Deelt via WhatsApp (web deeplink — werkt op iOS + Android + desktop) */
export function shareViaWhatsApp(payload: SharePayload): void {
  const text = buildShareText(payload);
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;

  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
  }
}

/** Opent de mail-client met vooraf ingevuld onderwerp + body */
export function shareViaEmail(payload: SharePayload, toEmail?: string): void {
  const subject = `WKB Borgingspunt — ${payload.taskTitle} (${payload.projectId})`;
  const body = buildShareText(payload).replace(/\*/g, '');
  const mailto = `mailto:${toEmail ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (Platform.OS === 'web') {
    window.location.href = mailto;
  }
}

/** Kopieert de tekst naar klembord */
export async function copyToClipboard(payload: SharePayload): Promise<void> {
  const text = buildShareText(payload).replace(/\*/g, '');
  if (Platform.OS === 'web' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
}

/** Gebruikt de Web Share API (iOS/Android native sheet) als beschikbaar */
export async function nativeShare(payload: SharePayload): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `WKB — ${payload.taskTitle}`,
        text: buildShareText(payload).replace(/\*/g, ''),
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
