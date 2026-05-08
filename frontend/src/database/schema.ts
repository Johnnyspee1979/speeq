import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const wkbSchema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'evidence',
      columns: [
        { name: 'evidence_id', type: 'string', isIndexed: true },
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'inspection_point_id', type: 'string', isIndexed: true },
        { name: 'media_uri', type: 'string' },
        { name: 'timestamp', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'gps_accuracy', type: 'number', isOptional: true },
        { name: 'exif_hash', type: 'string' },
        { name: 'exif_verified', type: 'boolean' },
        { name: 'user_id', type: 'string', isOptional: true },
        { name: 'field_note', type: 'string', isOptional: true },
        { name: 'stop_moment_confirmed', type: 'boolean', isOptional: true },
        { name: 'measurement_tool_confirmed', type: 'boolean', isOptional: true },
        { name: 'location_verified', type: 'boolean', isOptional: true },
        { name: 'location_spoof_risk', type: 'string', isOptional: true },
        { name: 'location_security_message', type: 'string', isOptional: true },
        { name: 'sync_status', type: 'string', isIndexed: true },
        { name: 'ai_status', type: 'string', isOptional: true },
        { name: 'ai_confidence', type: 'number', isOptional: true },
        { name: 'ai_notes', type: 'string', isOptional: true },
        { name: 'cloud_record_id', type: 'number', isOptional: true },
      ],
    }),
  ],
});
