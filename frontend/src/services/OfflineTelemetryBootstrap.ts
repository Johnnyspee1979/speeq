/**
 * OfflineTelemetryBootstrap — periodieke runner voor #56's aggregator.
 *
 * Roept `collectTelemetrySnapshot()` om de zoveel tijd aan en geeft de
 * snapshot door aan een optionele consumer (default: console.info).
 *
 * Aan te roepen vanuit OfflineSyncBootstrap zodra offline-mode aan staat.
 * Stop bij toggle uit of tenant-switch.
 *
 * Default: 1×/uur, naar console.info. Een toekomstige consumer kan dit
 * naar Supabase posten of aan Sentry/PostHog koppelen.
 */

import {
  collectTelemetrySnapshot,
  formatTelemetryLine,
  type OfflineTelemetrySnapshot,
} from './OfflineTelemetryAggregator';

export type TelemetryConsumer = (snapshot: OfflineTelemetrySnapshot) => void;

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 uur

let timer: ReturnType<typeof setInterval> | null = null;
let started = false;
let currentConsumer: TelemetryConsumer = (snap) => {
  // Default consumer — log compact line naar console
  // eslint-disable-next-line no-console
  console.info(formatTelemetryLine(snap));
};

/**
 * Start de telemetry-runner. Idempotent.
 *
 * @param consumer  optionele override van de default console-logger
 * @param intervalMs  default 1 uur
 */
export function startOfflineTelemetry(
  consumer?: TelemetryConsumer,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): void {
  if (started) return;
  started = true;
  if (consumer) currentConsumer = consumer;

  // Eerste tick direct na start
  void runOnce();

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void runOnce();
  }, intervalMs);
}

/**
 * Stop de telemetry-runner. Cleanup bij offline-mode uitschakelen.
 */
export function stopOfflineTelemetry(): void {
  if (!started) return;
  started = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Forceer een telemetry-snapshot nu. Handig voor "Stuur diagnose"-knop
 * in de UI.
 */
export async function captureTelemetryNow(): Promise<OfflineTelemetrySnapshot> {
  const snap = await collectTelemetrySnapshot();
  try {
    currentConsumer(snap);
  } catch (err) {
    // Consumer-fout mag never de telemetry-loop breken
    // eslint-disable-next-line no-console
    console.warn('[OfflineTelemetry] consumer-fout:', err);
  }
  return snap;
}

async function runOnce(): Promise<void> {
  try {
    await captureTelemetryNow();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[OfflineTelemetry] snapshot-fout:', err);
  }
}

/**
 * Voor tests — reset interne staat.
 * @internal
 */
export function __resetOfflineTelemetryForTests(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
