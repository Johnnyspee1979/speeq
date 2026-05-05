export const getWatermelonDatabase = () => {
  throw new Error(
    'WatermelonDB is alleen beschikbaar in native builds; de webapp gebruikt de SQLite/web fallback.'
  );
};
