import type { RankedItem } from './database.types';

export const PILLAR_EMOJIS: Record<string, string> = {
  product: '\u{1F9F4}',
  diet: '\u{1F957}',
  herbal: '\u{1F33F}',
  lifestyle: '\u{1F9D8}',
};

export const PILLAR_LABELS: Record<string, string> = {
  product: 'SKINCARE',
  diet: 'DIET',
  herbal: 'HERBAL',
  lifestyle: 'LIFESTYLE',
};

export const PILLAR_ORDER = ['product', 'diet', 'herbal', 'lifestyle'];

export function groupByPillar(items: RankedItem[]): [string, RankedItem[]][] {
  const grouped: Record<string, RankedItem[]> = {};
  for (const item of items) {
    if (!grouped[item.pillar]) grouped[item.pillar] = [];
    grouped[item.pillar].push(item);
  }
  const sorted: [string, RankedItem[]][] = [];
  for (const p of PILLAR_ORDER) {
    if (grouped[p]) sorted.push([p, grouped[p]]);
  }
  return sorted;
}
