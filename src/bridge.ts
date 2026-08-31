// Typed late-binding registry. Leaf module (imports only types) — breaks the
// cycles that previously put these on `window`. Setters assign after their
// definitions; readers call via optional-chain so unset fns no-op gracefully.
// DOM 类型(HTMLCanvasElement / CanvasRenderingContext2D / AudioContext)走 lib.dom,无需 import
import type { ClassDef, AchievementDef, TalentTree } from './types.js';
type VoidFn = () => void;

export const bridge: {
  // canvas / audio (render.ts / audio.ts init 时设)
  canvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;
  miniCtx?: CanvasRenderingContext2D;
  audioCtx?: AudioContext;
  muted: boolean;
  // data (main.ts 加载时设一次)
  classes: ClassDef[];
  achDefs: AchievementDef[];
  talentTrees: TalentTree[];
  // late-bound UI/render fns (main.ts 定义后设)
  render?: VoidFn; updateUI?: VoidFn; recalc?: VoidFn; markMinimapDirty?: VoidFn;
  validateTooltip?: VoidFn; // 批9 ⑧: updateUI 每回合校验 tooltip 目标是否还在
  renderInv?: VoidFn; renderHotbar?: VoidFn; renderHelp?: VoidFn; renderOptions?: VoidFn;
  closeEvent?: VoidFn;   // 批7: combat→events would cycle; death clears an open event popup via this slot
  openPause?: VoidFn; closePause?: VoidFn; closeOptions?: VoidFn; openSellInv?: VoidFn;
  toggleLang?: VoidFn; toggleSound?: VoidFn; updateLangUI?: VoidFn; updateSoundBtn?: VoidFn;
  initAudio?: VoidFn;
} = { muted: false, classes: [], achDefs: [], talentTrees: [] };
