// @ts-nocheck
import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Evidence extends Model {
  static table = 'evidence';

  @text('evidence_id') evidenceId?: string;
  @text('project_id') projectId?: string;
  @text('inspection_point_id') inspectionPointId?: string;
  @text('media_uri') mediaUri?: string;
  @text('timestamp') timestamp?: string;
  @field('latitude') latitude?: number;
  @field('longitude') longitude?: number;
  @field('gps_accuracy') gpsAccuracy?: number | null;
  @text('exif_hash') exifHash?: string;
  @field('exif_verified') exifVerified?: boolean;
  @text('user_id') userId?: string | null;
  @text('ifc_guid') ifcGuid?: string | null;
  @text('field_note') fieldNote?: string | null;
  @field('stop_moment_confirmed') stopMomentConfirmed?: boolean | null;
  @field('measurement_tool_confirmed') measurementToolConfirmed?: boolean | null;
  @field('location_verified') locationVerified?: boolean | null;
  @text('location_spoof_risk') locationSpoofRisk?: string | null;
  @text('location_security_message') locationSecurityMessage?: string | null;
  @text('sync_status') evidenceSyncStatus?: string;
  @text('ai_status') aiStatus?: string | null;
  @field('ai_confidence') aiConfidence?: number | null;
  @text('ai_notes') aiNotes?: string | null;
  @field('cloud_record_id') cloudRecordId?: number | null;
}
