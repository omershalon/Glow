/**
 * Cleans long Amazon product names into short, clean display names.
 * e.g. "CeraVe PM Facial Moisturizing Lotion, Night Cream with Hyaluronic Acid
 *       and Niacinamide, Ultra-Lightweight, Oil-Free Moisturizer for Face, 3 Ounce"
 *    → "PM Facial Moisturizing Lotion"
 */
export function cleanProductName(fullName: string, brand: string): string {
  let name = fullName;

  // Remove brand name from the start (case-insensitive)
  if (brand) {
    const brandRegex = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—]?\\s*`, 'i');
    name = name.replace(brandRegex, '');
  }

  // Cut at first comma, dash-with-descriptor, or pipe
  name = name
    .replace(/,\s.*$/, '')
    .replace(/\s*\|.*$/, '')
    .replace(/\s*-\s*(with|for|featuring|includes|contains|supports|promotes).*$/i, '')
    .replace(/\s*-\s*\d+\s*(oz|ml|fl|ct|count|pack|caps|tabs|softgel|serving).*$/i, '');

  // Remove size/quantity info in parens
  name = name.replace(/\s*\(.*?(oz|ml|fl|ct|count|pack|caps|tabs|softgel|serving).*?\)/gi, '');
  name = name.replace(/\s*\(Pack of \d+\)/gi, '');

  // Remove trailing size info
  name = name.replace(/\s+\d+(\.\d+)?\s*(oz|ml|fl|ct|count|pack|caps|tabs|softgel)s?\.?$/i, '');

  // Trim and cap length
  name = name.trim();
  if (name.length > 40) {
    name = name.substring(0, 40).replace(/\s\S*$/, '').trim();
  }

  return name || fullName.substring(0, 30);
}
