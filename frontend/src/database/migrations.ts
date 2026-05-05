import {
  addColumns,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

export const wkbMigrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'evidence',
          columns: [
            { name: 'stop_moment_confirmed', type: 'boolean', isOptional: true },
            { name: 'measurement_tool_confirmed', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'evidence',
          columns: [
            { name: 'location_verified', type: 'boolean', isOptional: true },
            { name: 'location_spoof_risk', type: 'string', isOptional: true },
            { name: 'location_security_message', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
