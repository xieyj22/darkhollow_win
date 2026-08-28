// First-pickup item intro popup — shows a card the first time an item/relic is
// acquired, with a queue so multi-pickup events (chests, kills, merchants) each
// get their own card. Discovered keys persist跨局 in MetaSave.discoveredItems.
import type { Item, ItemType } from './types.js';
import { introOpen, setIntroOpen, introEnabled } from './state.js';
import { discoverItem, discoverMechanic } from './meta.js';
import { showOverlay, hideOverlay } from './ui-panels.js';
import { t, tx, rareName, RARITY_C } from './i18n.js';
import { paintItemIcon, paintRelicIcon } from './sprites.js';
import {
  ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS,
  ALL_CONSUMABLES, FOODS, ENDLESS_GEAR, RELICS,
} from './data.js';

type IntroTarget = { kind: 'item'; item: Item } | { kind: 'relic'; id: string } | { kind: 'mechanic'; id: string };
const queue: IntroTarget[] = [];

// Batch2 ④: first-encounter mechanic tutorials (corruption/warden/fungal).
const MECHANIC_CARDS: Record<string, { sym: string; col: string; tk: string; bk: string }> = {
  corruption: { sym: '🟪', col: '#b583f6', tk: 'intro.mcCorruptionTitle', bk: 'intro.mcCorruptionBody' },
  warden:     { sym: '👁', col: '#9a2be2', tk: 'intro.mcWardenTitle',     bk: 'intro.mcWardenBody' },
  fungal:     { sym: '🍄', col: '#06d6a0', tk: 'intro.mcFungalTitle',     bk: 'intro.mcFungalBody' },
};

// Reverse-lookup a catalog def by type + id to read its flavor (and name for relics).
export function findCatalogDef(type: ItemType, id?: string): { flavor?: { en: string; zh: string }; n?: { en: string; zh: string } } | null {
  if (!id) return null;
  const search = <T extends { id?: string }>(arr: T[]) => arr.find(d => d.id === id) as ({ flavor?: any; n?: any } & T) | undefined;
  switch (type) {
    case 'weapon': return search([...ALL_WEAPONS, ...ENDLESS_GEAR.weapons]) || null;
    case 'armor': return search([...ALL_ARMORS, ...ENDLESS_GEAR.armors]) || null;
    case 'accessory': return search([...ALL_ACCESSORIES, ...ENDLESS_GEAR.accessories]) || null;
    case 'potion': return search(ALL_POTIONS) || null;
    case 'scroll': return search(ALL_SCROLLS) || null;
    case 'consumable': return search(ALL_CONSUMABLES) || null;
    case 'food': return search(FOODS) || null;
    default: return null;
  }
}

function keyFor(item: Item): string {
  return `${item.type}:${item.id || item.name}`;
}

export function queueItemIntro(item: Item): void {
  // Gold guard must run BEFORE the intro-disabled branch: otherwise a gold
  // pickup with intro OFF would record `gold:<name>` into discoveredItems.
  if (item.type === 'gold') return; // gold is never a catalog/discoverable item
  if (!introEnabled) { discoverItem(keyFor(item)); return; } // record for codex, no popup
  if (!discoverItem(keyFor(item))) return; // already discovered → no popup
  queue.push({ kind: 'item', item });
  if (!introOpen) showNext();
}

export function queueRelicIntro(id: string): void {
  if (!introEnabled) { discoverItem('relic:' + id); return; }
  if (!discoverItem('relic:' + id)) return;
  queue.push({ kind: 'relic', id });
  if (!introOpen) showNext();
}

export function queueMechanicIntro(id: string): void {
  if (!MECHANIC_CARDS[id]) return;
  if (!introEnabled) { discoverMechanic(id); return; }     // record for consistency, no popup
  if (!discoverMechanic(id)) return;                        // already seen
  queue.push({ kind: 'mechanic', id });
  if (!introOpen) showNext();
}

function showNext(): void {
  const target = queue.shift();
  if (!target) { hideOverlay('item-intro-overlay'); setIntroOpen(false); return; }
  document.getElementById('item-intro-content')!.innerHTML = renderCard(target);
  // Paint the pixel sprite into the card's canvas (item OR relic branch).
  const cv = document.querySelector<HTMLCanvasElement>('#item-intro-content canvas.lic');
  if (cv) {
    if (target.kind === 'item') paintItemIcon(cv, target.item);
    else {
      const rdef = RELICS.find(r => r.id === target.id);
      if (rdef) paintRelicIcon(cv, rdef);
    }
  }
  document.getElementById('item-intro-hint')!.textContent = t('intro.closeHint');
  setIntroOpen(true);
  showOverlay('item-intro-overlay');
}

export function closeItemIntro(): void {
  // Advance to the next queued card, or close if none left.
  if (queue.length) { showNext(); return; }
  hideOverlay('item-intro-overlay');
  setIntroOpen(false);
}

function statRow(label: string, val: string | number, color = '#ccc'): string {
  return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1c1c1c"><span style="color:#888">${label}</span><span style="color:${color};font-weight:700">${val}</span></div>`;
}

function renderCard(target: IntroTarget): string {
  if (target.kind === 'mechanic') {
    const mc = MECHANIC_CARDS[target.id];
    if (!mc) return '';
    return `
      <div style="text-align:center;margin-bottom:8px">
        <div style="font-size:2.2em;color:${mc.col};margin-top:4px">${mc.sym}</div>
        <div style="color:${mc.col};font-size:1.3em;font-weight:700;margin-top:4px">${t(mc.tk)}</div>
        <div style="color:#ffd700;font-size:.8em;margin-top:4px">✦ ${t('intro.firstDiscover')}</div>
      </div>
      <div style="background:rgba(155,83,229,.1);border:1px solid #9a2be2;border-radius:4px;padding:8px 10px;margin:8px 0">
        <div style="color:#e8d8ff">${t(mc.bk)}</div>
      </div>`;
  }
  if (target.kind === 'relic') {
    const def = RELICS.find(r => r.id === target.id);
    if (!def) return '';
    const flavor = def.flavor ? tx(def.flavor) : '';
    return `
      <div style="text-align:center;margin-bottom:8px">
        <canvas class="lic" width="16" height="16" style="image-rendering:pixelated;width:48px;height:48px;vertical-align:middle;background:${def.c}22;border:1px solid ${def.c};border-radius:4px;padding:4px" aria-hidden="true"></canvas>
        <div style="color:${RARITY_C[def.rarity] || '#ffd700'};font-size:1.3em;font-weight:700;margin-top:4px">${tx(def.n)}</div>
        <div style="color:#777;font-size:.8em">${t('intro.relicTag')} · ${rareName(def.rarity)}</div>
        <div style="color:#ffd700;font-size:.8em;margin-top:4px">✦ ${t('intro.firstDiscover')}</div>
      </div>
      <div style="background:rgba(155,83,229,.1);border:1px solid #9a2be2;border-radius:4px;padding:8px 10px;margin:8px 0">
        <div style="color:#c9a3ff;font-size:.85em;margin-bottom:3px">${t('intro.effect')}</div>
        <div style="color:#e8d8ff">${tx(def.d)}</div>
      </div>
      ${flavor ? `<div style="color:#9a9a9a;font-style:italic;font-size:.9em;margin-top:10px;border-left:2px solid #333;padding-left:10px">${flavor}</div>` : ''}`;
  }
  const item = target.item;
  const def = findCatalogDef(item.type, item.id);
  const flavor = def?.flavor ? tx(def.flavor) : '';
  const rc = RARITY_C[item.rarity] || '#ccc';
  let stats = '';
  if (item.atk) stats += statRow(t('intro.atk'), item.atk, '#f4845f');
  if (item.def) stats += statRow(t('intro.def'), item.def, '#7ec8e3');
  if (item.hp) stats += statRow(t('intro.hp'), item.hp, '#06d6a0');
  if (item.ef && item.ef !== 'food') stats += statRow(t('intro.effect'), item.desc);
  if (item.dur) stats += statRow(t('intro.duration'), item.dur + ' ' + t('intro.turns'));
  if (item.type === 'food') stats += statRow(t('intro.hunger'), item.val || 0);
  const setType = item.set ? `<div style="color:#9b5de5;font-size:.8em">${t('intro.set')}: ${item.set}</div>` : '';
  return `
    <div style="text-align:center;margin-bottom:8px">
      <canvas class="lic" width="16" height="16" style="image-rendering:pixelated;width:48px;height:48px;vertical-align:middle;background:${item.c}22;border:1px solid ${item.c};border-radius:4px;padding:4px" aria-hidden="true"></canvas>
      <div style="color:${rc};font-size:1.25em;font-weight:700;margin-top:6px">${item.name}</div>
      <div style="color:#777;font-size:.8em">${t('intro.type.' + item.type)} · ${rareName(item.rarity)}</div>
      <div style="color:#ffd700;font-size:.8em;margin-top:4px">✦ ${t('intro.firstDiscover')}</div>
    </div>
    ${setType}
    ${stats ? `<div style="margin:8px 0">${stats}</div>` : ''}
    ${flavor ? `<div style="color:#9a9a9a;font-style:italic;font-size:.9em;margin-top:10px;border-left:2px solid #333;padding-left:10px">${flavor}</div>` : ''}`;
}
