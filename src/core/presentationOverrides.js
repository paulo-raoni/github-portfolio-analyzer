import { readJsonFileIfExists } from '../io/files.js';

const VALID_PRESENTATION_STATES = new Set([
  'featured',
  'complete',
  'in-progress',
  'salvageable',
  'learning',
  'archived',
  'hidden'
]);

export async function loadPresentationOverrides(filePath) {
  const data = await readJsonFileIfExists(filePath);
  if (!data) return new Map();

  if (!Array.isArray(data.items)) return new Map();

  const map = new Map();
  for (const entry of data.items) {
    const slug = typeof entry?.slug === 'string' ? entry.slug.trim() : null;
    const state = typeof entry?.presentationState === 'string'
      ? entry.presentationState.trim()
      : null;

    if (!slug || !state) continue;
    if (!VALID_PRESENTATION_STATES.has(state)) continue;

    map.set(slug, { presentationState: state });
  }
  return map;
}

export function applyPresentationOverrides(items, overridesMap) {
  return items.map((item) => {
    const override = overridesMap.get(item.slug);
    if (!override) return item;
    return { ...item, ...override };
  });
}
