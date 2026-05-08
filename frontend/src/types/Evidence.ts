export interface WkbEvidence {
  id: string; // Unieke UUID
  projectId: string; // Bijv. projectnummer uit AFAS of Exact
  inspectionPointId: string; // Verwijzing naar het KiK-borgingsplan
  mediaUri: string; // Lokaal pad naar de opgeslagen foto op de telefoon
  timestamp: string; // Onveranderbare ISO-8601 tijdstempel
  latitude: number; // GPS data voor locatiebewijs
  longitude: number; // GPS data voor locatiebewijs
  gpsAccuracy: number | null; // Nauwkeurigheid van de GPS fix in meters
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  exifHash: string; // SHA-256 hash van de originele foto
  exifVerified: boolean; // Bevestigt dat EXIF metadata meegeleverd is
  userId?: string | null; // Herleidt wie het bewijs vastlegde
  ifcGuid?: string | null; // Optionele BIM/IFC koppeling via QR-sticker
  fieldNote?: string | null; // Korte notitie van de vakman op de steiger
  weatherLabel?: string | null; // Automatisch opgehaald weer op het moment van de foto
  stopMomentConfirmed?: boolean | null; // Bevestigt dat het verplichte stopmoment is gerespecteerd
  measurementToolConfirmed?: boolean | null; // Bevestigt dat rolmaat/waterpas fysiek in beeld was indien vereist
  locationVerified?: boolean | null; // Bevestigt dat GPS-controle binnen projectzone en nauwkeurigheidseis viel
  locationSpoofRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | null; // Samenvatting van spoof-/projectlocatierisico
  locationSecurityMessage?: string | null; // Menselijke uitleg van de locatiecontrole
  // Locatie-context (ContextForm)
  etage?: string | null;
  ruimtenummer?: string | null;
  binnenbuiten?: 'BINNEN' | 'BUITEN' | null;
  locatieDetail?: string | null; // bijv. "Gevel West", "Achtergevel", "Badkamer"
  context_extra?: Record<string, unknown> | null;
  floorPlanId?: string | null;   // Verwijzing naar geüploade bouwtekening
  pinX?: number | null;          // 0.0–1.0 genormaliseerde x-positie op tekening
  pinY?: number | null;          // 0.0–1.0 genormaliseerde y-positie op tekening
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED'; // Offline-first syncstatus
}

export type EvidenceSyncStatus = WkbEvidence['syncStatus'];

export interface StoredWkbEvidence extends WkbEvidence {
  rowId?: number;
  aiStatus?: 'PENDING' | 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
  aiConfidence?: number | null;
  aiNotes?: string | null;
  cloudRecordId?: number | null;
}
