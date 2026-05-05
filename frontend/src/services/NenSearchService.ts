import Fuse from 'fuse.js';
import { NEN_NORM_DATABASE, type NenNorm } from '../constants/NenStandards';

const fuse = new Fuse(NEN_NORM_DATABASE, {
  threshold: 0.34,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: [
    { name: 'code', weight: 0.32 },
    { name: 'title', weight: 0.22 },
    { name: 'keywords', weight: 0.18 },
    { name: 'description', weight: 0.16 },
    { name: 'wkbCheck', weight: 0.08 },
    { name: 'category', weight: 0.04 },
  ],
});

export const searchNenNorm = (query: string): NenNorm[] => {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return NEN_NORM_DATABASE;
  }

  return fuse.search(normalizedQuery).map((result) => result.item);
};
