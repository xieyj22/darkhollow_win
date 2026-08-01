# Playtest #9 Phase 2: Endings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Checkbox (`- [ ]`) steps.

**Goal:** Replace the static F40 victory screen with a Creator **choice** (Slay / Refuse; Refuse gated to `corruption < 50`), resolving to one of 3 endings (Pyrrhic Victor / Doombringer / Guardian) recorded as achievements.

**Architecture:** New pure leaf `src/endings.ts` (ENDINGS data + `endingForChoice` + `canRefuse`) is the testable core. `playerVictory` presents the choice instead of the victory screen; new `resolveEnding(choice)` shows the victory screen with the ending's title/body. Buttons bound in `main.ts`. Endings tracked via the existing achievement system (no new MetaSave field).

**Tech Stack:** TypeScript, Vite, vitest+happy-dom. Pinned at `0023f8f`.

## Global Constraints

(From `docs/superpowers/specs/2026-08-01-endings-design.md`.)
- **Only the Creator (F40, normal mode)** gets a choice. Endless F40 doesn't trigger `playerVictory` (Wave 6d) — unchanged.
- **Refuse gated** to `corruption < REFUSE_CORRUPTION_THRESHOLD (50)`; high corruption forces Slay.
- **No Phase 3 legacy** — endings recorded as achievements only, no ghost/legacy entity.
- No combat/corruption stat changes; no new MetaSave field (reuse achievements).
- reducedMotion / bilingual per existing patterns.
- Code pinned at `0023f8f`.

---

## File Structure

- **Create `src/endings.ts`** (pure: ENDINGS, endingForChoice, canRefuse, types/threshold).
- **Create `src/__tests__/endings.test.ts`** (endingForChoice + canRefuse).
- **Modify `src/combat.ts`** (`playerVictory` → present choice; new `resolveEnding` + `presentCreatorChoice`; import endings).
- **Modify `src/data.ts`** (`ACH_DEFS` +3 ending achievements).
- **Modify `index.html`** (`#ending-choice` overlay + `#vic-ending` block in victory-screen).
- **Modify `src/main.ts`** (bind the 2 ending buttons → resolveEnding; import it).

---

## Task 1: `endings.ts` pure module + test

**Files:** Create `src/endings.ts`, `src/__tests__/endings.test.ts`.
**Produces:** `EndingId`, `CreatorChoice`, `REFUSE_CORRUPTION_THRESHOLD`, `EndingDef`, `ENDINGS`, `endingForChoice`, `canRefuse`.

- [ ] **Step 1: failing test** `src/__tests__/endings.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { endingForChoice, canRefuse } from '../endings.js';

describe('endingForChoice', () => {
  it('refuse → guardian regardless of corruption', () => {
    expect(endingForChoice('refuse', 0)).toBe('guardian');
    expect(endingForChoice('refuse', 99)).toBe('guardian');
  });
  it('slay splits at corruption 50', () => {
    expect(endingForChoice('slay', 0)).toBe('pyrrhic');
    expect(endingForChoice('slay', 49)).toBe('pyrrhic');
    expect(endingForChoice('slay', 50)).toBe('doombringer');
    expect(endingForChoice('slay', 99)).toBe('doombringer');
  });
});
describe('canRefuse', () => {
  it('true below 50, false at/above', () => {
    expect(canRefuse(0)).toBe(true);
    expect(canRefuse(49)).toBe(true);
    expect(canRefuse(50)).toBe(false);
    expect(canRefuse(99)).toBe(false);
  });
});
```

- [ ] **Step 2: RED** (`npx vitest run src/__tests__/endings.test.ts`).
- [ ] **Step 3: write `src/endings.ts`** (ENDINGS bodies verbatim from the spec §1):
```ts
import type { I18nText } from './types.js';

export type EndingId = 'pyrrhic' | 'doombringer' | 'guardian';
export type CreatorChoice = 'slay' | 'refuse';
export const REFUSE_CORRUPTION_THRESHOLD = 50;

export interface EndingDef { id: EndingId; ach: string; title: I18nText; body: I18nText; }

export const ENDINGS: Record<EndingId, EndingDef> = {
  pyrrhic:    { id:'pyrrhic',    ach:'end_pyrrhic', title:{en:'Pyrrhic Victor',zh:'悲壮英雄'}, body:{en:'The Creator thanks you as they fall. The seal shatters — and through the crack, the true abyss begins to seep. You did your duty. You also ended the world.',zh:'创世者在倒下时向你致谢。封印碎裂——真深渊从裂隙中渗出。你完成了使命,也终结了世界。'} },
  doombringer:{ id:'doombringer',ach:'end_doom',    title:{en:'Doombringer',    zh:'末日使者'}, body:{en:'It was not your hand that moved — it was the abyss moving through you. The seal breaks, the real abyss pours forth, and you stand at its vanguard: the doombringer it shaped you to be.',zh:'动手的不是你,是深渊借你的手。封印崩塌,真深渊奔涌而出,你站在它最前——它把你塑造成的末日使者。'} },
  guardian:   { id:'guardian',   ach:'end_guardian',title:{en:'The Guardian',   zh:'守誓者'},   body:{en:"You lower your blade. You will not be the one to break the seal. You take the Creator's place at the heart of the wound, and bear the thousand-year burden they finally lay down.",zh:'你放下剑。你不会是击碎封印的那个人。你走到伤口的心脏,接过创世者的位置,担起 Ta 终于卸下的千年重负。'} },
};

export function endingForChoice(choice: CreatorChoice, corruption: number): EndingId {
  if (choice === 'refuse') return 'guardian';
  return corruption >= REFUSE_CORRUPTION_THRESHOLD ? 'doombringer' : 'pyrrhic';
}
export function canRefuse(corruption: number): boolean { return corruption < REFUSE_CORRUPTION_THRESHOLD; }
```
- [ ] **Step 4: GREEN.** Step 5: typecheck + build. Step 6: commit `Wave9P2 Task 1: endings module + test`.

---

## Task 2: achievements + UI markup

**Files:** `src/data.ts` (ACH_DEFS), `index.html` (#ending-choice overlay + #vic-ending).

- [ ] **data.ts `ACH_DEFS`** — append 3:
```ts
  { id: 'end_pyrrhic', icon: '🏆', n: { en: 'Pyrrhic Victor', zh: '悲壮英雄' }, d: { en: 'Slay the Creator (low corruption)', zh: '击杀创世者(低腐化)' } },
  { id: 'end_doom', icon: '💀', n: { en: 'Doombringer', zh: '末日使者' }, d: { en: 'Slay the Creator while deeply corrupted', zh: '高腐化下击杀创世者' } },
  { id: 'end_guardian', icon: '🛡', n: { en: 'The Guardian', zh: '守誓者' }, d: { en: 'Refuse to slay the Creator', zh: '拒绝击杀创世者' } },
```
- [ ] **index.html** — add the `#ending-choice` overlay (clone the records/codex overlay structure) next to the other overlays:
```html
<div id="ending-choice" class="overlay"><div class="panel" style="min-width:480px;max-width:600px"><h2 id="ending-title">The Creator Falls</h2><p id="ending-desc" style="color:#bbb;margin:10px 0"></p><div style="display:flex;gap:10px;justify-content:center"><button class="menu-btn" id="btn-ending-slay">⚔ Slay</button><button class="menu-btn" id="btn-ending-refuse">🛡 Refuse</button></div></div></div>
```
- [ ] **index.html `#victory-screen`** — add `<div id="vic-ending" style="margin:8px 0;max-width:520px"></div>` above `#vic-stats`.
- [ ] typecheck + build. Commit `Wave9P2 Task 2: ending achievements + choice/victory markup`.

---

## Task 3: `playerVictory` → choice + `resolveEnding`

**Files:** `src/combat.ts` (imports; `playerVictory`; new `presentCreatorChoice` + `resolveEnding`).

- [ ] **imports** — add `import { ENDINGS, endingForChoice, canRefuse } from './endings.js';`
- [ ] **module var for pending echoes** (so resolveEnding can render the breakdown after the choice): near the top, `let _pendingEchoes: SoulEchoBreakdown | null = null;` (SoulEchoBreakdown is already imported in combat.ts).
- [ ] **`playerVictory`** — keep everything through `recordRun(...)`, then **replace** the victory-screen display + renderEchoBreakdown + `localStorage.removeItem('dh_save')` with: stash echoes + present the choice:
```ts
  recordRun({ mode: 'normal', floor: G.floor, kills: p.kills, classIdx: p.ci, result: 'win', turns: p.turns, gold: p.gold, ts: Date.now() });

  // Phase 2: present the Creator choice (Slay / Refuse) instead of straight to victory-screen.
  _pendingEchoes = echoes;
  presentCreatorChoice(p);
}

function presentCreatorChoice(p: Player): void {
  const zh = lang === 'zh';
  const refuse = canRefuse(p.corruption);
  document.getElementById('ending-title')!.textContent = zh ? '创世者倒下了' : 'The Creator Falls';
  document.getElementById('ending-desc')!.textContent = refuse
    ? (zh ? 'Ta 渴望解脱。你将……' : 'They beg for release. Will you…')
    : (zh ? '深渊在你血脉中嘶吼,你已无法抗拒击碎封印的冲动。' : 'The abyss howls in your blood — you can no longer resist the urge to shatter the seal.');
  const rb = document.getElementById('btn-ending-refuse') as HTMLButtonElement;
  rb.disabled = !refuse;
  rb.style.opacity = refuse ? '1' : '0.4';
  document.getElementById('ending-choice')!.style.display = 'flex';
}

export function resolveEnding(choice: 'slay' | 'refuse'): void {
  if (!G) return;
  const p = G.player;
  document.getElementById('ending-choice')!.style.display = 'none';
  const id = endingForChoice(choice, p.corruption);
  const e = ENDINGS[id];
  checkAch(e.ach); // records the ending achievement (+ Steam)
  const zh = lang === 'zh';
  document.getElementById('vic-ending')!.innerHTML =
    `<h2 style="color:${id === 'guardian' ? '#06d6a0' : id === 'doombringer' ? '#e63946' : '#ffd700'}">${zh ? e.title.zh : e.title.en}</h2>` +
    `<p style="color:#ccc;font-size:.95em">${zh ? e.body.zh : e.body.en}</p>`;
  document.getElementById('victory-screen')!.style.display = 'flex';
  document.getElementById('vic-stats')!.innerHTML =
    `<span style="color:#ffd700">🏆 ${zh ? '暗渊英雄' : 'HERO OF DARKHOLLOW'} 🏆</span><br><br>` +
    `${zh ? '等级' : 'Level'} ${p.level} ${p.raceName} ${p.clsName}<br>` +
    `${zh ? '到达第' : 'Floor'} ${G.floor}<br>${p.kills} ${zh ? '击杀' : 'kills'}<br>` +
    `${p.gold} ${zh ? '金币' : 'gold'}<br>${p.turns} ${zh ? '回合' : 'turns'}<br>` +
    `${zh ? '腐化' : 'Corruption'} ${p.corruption}`;
  if (_pendingEchoes) renderEchoBreakdown('vic-echoes', _pendingEchoes);
  _pendingEchoes = null;
  localStorage.removeItem('dh_save');
}
```
(Remove the old victory-screen/vic-stats/renderEchoBreakdown/removeItem lines from `playerVictory` — they're now in `resolveEnding`. Keep `checkAch('win')`/`checkAch('creator_kill')` in `playerVictory`.)
- [ ] typecheck + build + vitest. Commit `Wave9P2 Task 3: playerVictory → Creator choice + resolveEnding`.

---

## Task 4: bind ending buttons (main.ts)

**Files:** `src/main.ts` (imports; bindButtons).

- [ ] **import** — add `resolveEnding` to the combat import (`import { ... playerVictory ..., resolveEnding } from './combat.js';` — confirm the exact line at impl; main.ts L15 imports several from combat).
- [ ] **bindButtons** — add (near the records/codex binds):
```ts
  on('btn-ending-slay', () => resolveEnding('slay'));
  on('btn-ending-refuse', () => resolveEnding('refuse'));
```
- [ ] typecheck + build + vitest. Commit `Wave9P2 Task 4: bind ending choice buttons`.

---

## Task 5: verification

- [ ] `npx vitest run` all green (endings.test + existing 127).
- [ ] `npm run typecheck && npm run build` clean.
- [ ] Playtest (manual): F40 normal Creator kill → `#ending-choice` appears; low-corruption run can Refuse → Guardian ending + `end_guardian` ach; high-corruption run Refuse disabled → Slay → Doombringer + `end_doom`; endless F40 unaffected.

---

## Self-Review

**1. Spec coverage:** endings.ts (Task 1) ✅; achievements + UI markup (Task 2) ✅; playerVictory choice + resolveEnding (Task 3) ✅; button binding (Task 4) ✅. Refuse gated <50 (canRefuse + disabled button) ✅. Endings via achievements (no MetaSave field) ✅. Non-goals (no Phase 3 legacy, endless unaffected, only Creator choice) ✅.
**2. Placeholders:** endings.ts is full code+test (bodies verbatim from spec). Tasks 2-4 are function/markup-level with exact snippets. The `presentCreatorChoice`/`resolveEnding` bodies are full. The `_pendingEchoes` stash bridges the echoes computed in playerVictory to renderEchoBreakdown in resolveEnding.
**3. Type consistency:** `endingForChoice`/`canRefuse`/`ENDINGS`/`EndingId`/`CreatorChoice` names match across tasks. `resolveEnding(choice: 'slay'|'refuse')` matches CreatorChoice. ACH ids (`end_pyrrhic`/`end_doom`/`end_guardian`) match `ENDINGS[*].ach`. `#btn-ending-slay/refuse`, `#ending-choice/title/desc`, `#vic-ending` ids match between index.html and combat/main.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-01-darkhollow-playtest9-endings.md`. Options:
**1. Subagent-Driven** — per-task subagent + review.
**2. Inline Execution** — this session via executing-plans.
Which approach?
