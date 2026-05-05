import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import Evidence from './Evidence';
import { wkbMigrations } from './migrations';
import { wkbSchema } from './schema';

let database: Database | null = null;

const createDatabase = () => {
  if (Platform.OS === 'web') {
    throw new Error(
      'WatermelonDB SQLiteAdapter is bedoeld voor native React Native; gebruik op web de bestaande lokale fallback.'
    );
  }

  const adapter = new SQLiteAdapter({
    schema: wkbSchema,
    migrations: wkbMigrations,
    jsi: true,
    onSetUpError: (error) => {
      console.error('❌ Fout bij het opzetten van de WatermelonDB-laag:', error);
    },
  });

  return new Database({
    adapter,
    modelClasses: [Evidence],
  });
};

export const getWatermelonDatabase = () => {
  if (!database) {
    database = createDatabase();
    console.log('✅ WatermelonDB succesvol geïnitialiseerd voor de Wkb app.');
  }

  return database;
};
