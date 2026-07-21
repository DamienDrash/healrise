export const PLAN_ORDER = ['freebie', 'healrise7', 'healrise14', 'premium'];

export const PLAN_META = {
  /* Plan-Farben = HEALRISE-Palette: Stone-Grau → Copper → Copper (AA) → Ink */
  freebie:    { label: 'Freebie',           color: '#83867D', price: '0 €',   emoji: '✦' },
  healrise7:  { label: 'HEALRISE 7',        color: '#B8734F', price: '69 €',  emoji: '✦✦' },
  healrise14: { label: 'HEALRISE 14',       color: '#9C5E3D', price: '169 €', emoji: '✦✦✦' },
  premium:    { label: 'HEALRISE Premium',  color: '#1E2321', price: '399 €', emoji: '✦✦✦✦' },
};

export const CATEGORY_META = {
  ernaehrung:   { label: 'Ernährung',      icon: '🌿' },
  bewegung:     { label: 'Bewegung',       icon: '🤸' },
  selfcare:     { label: 'Selfcare',       icon: '🌸' },
  mindset:      { label: 'Mindset',        icon: '☀️' },
  supplements:  { label: 'Supplements',   icon: '💊' },
  // Key/Slug bleibt aus URL-/Datenstabilität „narbenpflege" — sichtbares Label ist „Hautpflege"
  narbenpflege: { label: 'Hautpflege',    icon: '🌙' },
  allgemein:    { label: 'Allgemein',      icon: '📋' },
};

export const CONTENT_TYPE_META = {
  guide:    { label: 'Guide',    icon: '📖' },
  video:    { label: 'Video',   icon: '▶️' },
  tipp:     { label: 'Tipp',    icon: '💡' },
  uebung:   { label: 'Übung',   icon: '🏃' },
  rezept:   { label: 'Rezept',  icon: '🥗' },
};

export function canAccess(userPlan, requiredPlan) {
  const ui = PLAN_ORDER.indexOf(userPlan ?? 'freebie');
  const ri = PLAN_ORDER.indexOf(requiredPlan ?? 'freebie');
  return ui >= ri;
}

export function planIndex(plan) {
  return PLAN_ORDER.indexOf(plan ?? 'freebie');
}
