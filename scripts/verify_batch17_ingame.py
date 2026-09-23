# In-game verification for batch17「平衡大修」(公式+数值组合拳).
# Dev server + live module imports (同 verify_batch2_ingame.py 惯例) — 验证真实接线:
#   1  公式等价: attack() 低层 def 下 dmg = floor(atk*100/(100+def))
#   2  def 墙消除: def=145 vs atk=106 → 43 (旧公式=1)
#   3  圣光术附带神圣伤害段 (Paladin heal case)
#   4  法师 base HP 38 (createPlayer 真路径)
#   5  施法腐化概率门: random=0.4 → +1 / random=0.6 → +0
#   6  掉落加权: genWeapon(40)×400 r≥3 占比 ≥55% (均匀基线 42.3%)
#   7  无尽窗口 F55 直供: ENEMIES mf∈[51,55] 非空 (Entropy Beast 52)
#   8  全程零 console error
# Run: npm run dev -- --port 5173 --strictPort, then:
#      python scripts/verify_batch17_ingame.py
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
results = []
console_errors = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


def start_game(page):
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex'


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page()
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and 'favicon' not in (m.location or {}).get('url', '') else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.goto(BASE)
        page.wait_for_timeout(1200)
        start_game(page)

        # ============ 1-2: 公式（真实 attack() + 钉 Math.random） ============
        print('[1-2] damage formula: equivalence + no wall')
        r12 = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const cb = await import('/src/combat.ts');
            const d = await import('/src/data.ts');
            const fac = await import('/src/enemy-factory.ts');
            const p = st.G.player;
            const out = {};
            const origRandom = Math.random;
            Math.random = () => 0.5;  // rng(-2,2)=0; warrior crit 11% → 无暴击
            // 1. atk100 vs def3 → floor(100*100/103)=97
            const e1 = fac.makeEnemy(d.ENEMIES.find(x => x.n.en === 'Goblin'), p.x + 1, p.y, 1);
            e1.def = 3; e1.hp = 999; e1.maxHp = 999;
            st.G.enemies = [e1];
            cb.attack({ atk: 100, el: 'none', x: p.x, y: p.y }, e1, true);
            out.dmg97 = 999 - e1.hp;
            // 2. def 墙: atk106 vs def145 → floor(106*100/245)=43（旧公式 max(1,106-145)=1）
            const e2 = fac.makeEnemy(d.ENEMIES.find(x => x.n.en === 'Goblin'), p.x + 1, p.y, 1);
            e2.def = 145; e2.hp = 999; e2.maxHp = 999;
            st.G.enemies = [e2];
            cb.attack({ atk: 106, el: 'none', x: p.x, y: p.y }, e2, true);
            out.dmgWall = 999 - e2.hp;
            Math.random = origRandom;
            st.G.enemies = [];
            return out;
        }""")
        check('formula equivalence atk100/def3 → 97', r12['dmg97'] == 97, f"got {r12['dmg97']}")
        check('no def wall atk106/def145 → 43 (old=1)', r12['dmgWall'] == 43, f"got {r12['dmgWall']}")

        # ============ 3: 圣光术附带伤害 ============
        print('[3] paladin holy-light damage segment')
        r3 = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const sk = await import('/src/skills.ts');
            const d = await import('/src/data.ts');
            const fac = await import('/src/enemy-factory.ts');
            const p = st.G.player;
            p.ci = 3; p.mp = 99; p.skillCd = 0; p.hp = Math.floor(p.maxHp * 0.3);
            const foe = fac.makeEnemy(d.ENEMIES.find(x => x.n.en === 'Goblin'), p.x + 1, p.y, 1);
            foe.hp = 200; foe.maxHp = 200;
            st.G.enemies = [foe];
            const hpBefore = foe.hp;
            sk.executeSkill({ cost: 6, effect: 'heal', cd: 9 });
            const delta = hpBefore - foe.hp;
            st.G.enemies = [];
            return { delta, healed: p.hp > Math.floor(p.maxHp * 0.3) };
        }""")
        check('holy light damages nearby foe (~1.2×atk)', r3['delta'] >= 5, f"delta {r3['delta']}")
        check('holy light still heals', r3['healed'])

        # ============ 4: 法师 base HP ============
        print('[4] mage base hp 38')
        r4 = page.evaluate("""async () => {
            const pl = await import('/src/player.ts');
            return pl.createPlayer(0, 2, false).maxHp;
        }""")
        check('mage createPlayer maxHp=38', r4 == 38, f"got {r4}")

        # ============ 5: 施法腐化概率门 ============
        print('[5] cast corruption probabilistic gate')
        r5 = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const sk = await import('/src/skills.ts');
            const p = st.G.player;
            const out = {};
            const origRandom = Math.random;
            p.mp = 99; p.corruption = 10;
            Math.random = () => 0.4;  // <0.5 → 腐化 +1
            p.skillCd = 0; sk.executeSkill({ cost: 5, effect: 'stun', cd: 8 });
            out.at04 = p.corruption;
            Math.random = () => 0.6;  // ≥0.5 → 不腐化
            p.skillCd = 0; p.mp = 99; sk.executeSkill({ cost: 5, effect: 'stun', cd: 8 });
            out.at06 = p.corruption;
            Math.random = origRandom;
            p.corruption = 0;
            return out;
        }""")
        check('random 0.4 → corruption +1', r5['at04'] == 11, f"got {r5['at04']}")
        check('random 0.6 → corruption unchanged', r5['at06'] == 11, f"got {r5['at06']}")

        # ============ 6: 掉落加权 ============
        print('[6] drop rarity weighting at F40')
        r6 = page.evaluate("""async () => {
            const gen = await import('/src/item-gen.ts');
            let hi = 0; const N = 400;
            for (let i = 0; i < N; i++) { const w = gen.genWeapon(40); if (w.rarity >= 3) hi++; }
            return { hi, N };
        }""")
        share6 = r6['hi'] / r6['N']
        check('genWeapon(40) r>=3 share >= 55% (uniform 42.3%)', share6 >= 0.55, f"{r6['hi']}/{r6['N']} = {share6:.1%}")

        # ============ 7: 无尽窗口 F55 直供 ============
        print('[7] endless window feeds F55')
        r7 = page.evaluate("""async () => {
            const d = await import('/src/data.ts');
            const win = d.ENEMIES.filter(e => e.mf <= 55 && e.mf >= 51);
            return { count: win.length, hasEntropy: win.some(e => e.n.en === 'Entropy Beast') };
        }""")
        check('F55 window [51,55] non-empty (Entropy Beast 52)', r7['count'] >= 1 and r7['hasEntropy'], f"count {r7['count']}")

        browser.close()

    print()
    fails = [r for r in results if not r[1]]
    if console_errors:
        print(f"FAIL  console errors: {len(console_errors)}")
        for e in console_errors[:5]:
            print('   ', e[:200])
        fails.append(('console errors', False, ''))
    print(f"===== batch17 battery: {len(results) - len(fails)}/{len(results) + (1 if console_errors else 0)} checks, {len(console_errors)} console errors =====")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
