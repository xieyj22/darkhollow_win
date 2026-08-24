# In-game verification for feat/reconnect-batch (批1「断线重连」).
# Runs against the Vite DEV server so page.evaluate can `import('/src/*.ts')`
# and get the SAME live module instances the game loop uses — the checks below
# exercise the real wiring (i18n, log DOM, module graph), not unit mocks.
#   ② fountain cleanses corruption (tile injected adjacent + REAL ArrowRight)
#   ① endless F45+ boss phase + summon from the instance (live modules)
#   ③ Sanctuary blocks stun / CC applies without it
#   ④ #title-stats renders after reload
# Run: npm run dev -- --port 5173 --strictPort, then:
#      python scripts/verify_reconnect_ingame.py
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


def log_text(page):
    return page.evaluate("document.getElementById('log-panel')?.textContent ?? ''")


def start_game(page):
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex'


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page()
        # favicon.ico 404s are dev-server noise (vite dev serves no favicon;
        # the Electron/dist build whitelists it) — filter, not game-related.
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and 'favicon' not in (m.location or {}).get('url', '') else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.on('response', lambda r: print(f'    [404] {r.url}') if r.status == 404 and 'favicon' not in r.url else None)
        page.goto(BASE)
        page.wait_for_timeout(1200)

        # ============ ② fountain cleanses corruption ============
        print('[②] fountain cleanse (normal mode, real keypress)')
        start_game(page)
        state = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const cb = await import('/src/combat.ts');
            cb.applyCorruption(30);
            return { corruption: st.G.player.corruption, x: st.G.player.x, y: st.G.player.y };
        }""")
        print(f"    injected corruption=30 -> actual {state['corruption']}, player at ({state['x']},{state['y']})")
        # Inject a FOUNTAIN one tile to the right of the player, then really walk onto it.
        page.evaluate("""async (px) => {
            const st = await import('/src/state.ts');
            const cfg = await import('/src/config.ts');
            st.G.dungeon.map[st.G.player.y][st.G.player.x + 1] = cfg.TL.FOUNTAIN;
        }""", state['x'])
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(400)
        after = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const cfg = await import('/src/config.ts');
            return { corruption: st.G.player.corruption,
                     tile: st.G.dungeon.map[st.G.player.y][st.G.player.x],
                     water: cfg.TL.WATER };
        }""")
        check('② corruption 30 -> 15 after stepping on fountain', after['corruption'] == 15,
              f"corruption={after['corruption']}")
        check('② fountain consumed (tile -> WATER)', after['tile'] == after['water'],
              f"tile={after['tile']} water={after['water']}")
        msg_ok = ('清泉洗去腐化' in log_text(page)) or ('washes away corruption' in log_text(page))
        check('② purify message appears in log', msg_ok)

        # ============ ① endless F45+ boss phase + summon ============
        print('[①] endless F45+ boss phase & summon (live modules)')
        page.evaluate("async () => { const g = await import('/src/game.ts'); g.initGame(0, 2, true); }")
        page.wait_for_timeout(600)
        phase = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const en = await import('/src/enemies.ts');
            const fac = await import('/src/enemy-factory.ts');
            st.G.floor = 45;
            const bd = en.endlessBossPool().find(b => b.phases && b.phases.length && b.summon);
            const fs = 1 + (45 - 1) * .1;
            const boss = fac.makeEnemy(bd, st.G.player.x + 1, st.G.player.y, fs, { isBoss: true });
            st.G.enemies = [boss];                       // isolate for deterministic assertions
            boss.hp = Math.floor(boss.maxHp * 0.3);      // below first hpThreshold
            const atkBefore = boss.atk;
            en.processBossPhase(boss);
            const phaseInfo = { name: bd.n.en, atkBefore, atkAfter: boss.atk,
                                base: boss.bossAtkBase, triggered: boss.phasesTriggered ? boss.phasesTriggered.size : 0 };
            // summon: force ONLY the chance gate (first Math.random call); the
            // rng(-2,2) spawn-attempt rolls must stay real, else all 8 attempts
            // pick the same tile and a wall there starves the summon.
            const origRandom = Math.random; let calls = 0;
            Math.random = () => (calls++ < 1 ? 0 : origRandom());
            en.tryBossSummon(boss);
            Math.random = origRandom;
            phaseInfo.addCount = st.G.enemies.length - 1;
            phaseInfo.addNames = st.G.enemies.slice(1).map(e => e.name);
            phaseInfo.aiCd = boss.aiCd;
            return phaseInfo;
        }""")
        check('① F45 endless boss phases trigger from instance', phase['triggered'] >= 1,
              f"{phase['name']}: atk {phase['atkBefore']}->{phase['atkAfter']} (base {phase['base']})")
        expect_atk = int(phase['base'] * 1.4)  # Goblin King first phase atkM 1.4 (floor)
        check('① phase atk scaled from bossAtkBase', phase['atkAfter'] == expect_atk,
              f"atkAfter={phase['atkAfter']} expected={expect_atk}")
        check('① summon spawns themed add at F45 (no table entry for fl=45)',
              phase['addCount'] >= 1 and any('Goblin' in n for n in phase['addNames']),
              f"adds={phase['addNames']}, aiCd={phase['aiCd']}")

        # ============ ③ Sanctuary blocks stun / CC live without it ============
        print('[③] Sanctuary immunity + live CC (live modules)')
        cc = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const es = await import('/src/enemy-skills.ts');
            const out = {};
            const caster = { name: 'T', x: st.G.player.x + 1, y: st.G.player.y, hp: 10, maxHp: 10, atk: 5, def: 1, isAlly: false, el: 'none', skillCd: 0 };
            const sk = { name: { en: 'T', zh: 'T' }, effect: 'debuff_stun', chance: 1, cd: 1, aoe: 2 };
            st.G.player.talents.talents['p_sanctuary'] = 1;
            es.executeEnemySkill(caster, sk);
            out.withTalent = st.G.player.stunned ?? 0;
            delete st.G.player.talents.talents['p_sanctuary'];
            delete st.G.player.stunned;
            es.executeEnemySkill(caster, sk);
            out.withoutTalent = st.G.player.stunned ?? 0;
            return out;
        }""")
        check('③ Sanctuary blocks the stun (stunned stays 0)', cc['withTalent'] == 0, str(cc))
        check('③ without Sanctuary the stun lands (CC online)', cc['withoutTalent'] == 2, str(cc))
        msg_ok = ('庇护所生效' in log_text(page)) or ('shrug off the stun' in log_text(page))
        check('③ stunImmune message appears in log', msg_ok)

        # ============ ④ title stats render after reload ============
        print('[④] #title-stats renders on title screen')
        page.reload()
        page.wait_for_timeout(1200)
        ts = page.evaluate("document.getElementById('title-stats')?.innerHTML ?? ''")
        check('④ #title-stats non-empty after reload', len(ts) > 30, f"len={len(ts)}")

        browser.close()

    fails = [r for r in results if not r[1]]
    print(f"\nTotal {len(results)} checks, {len(fails)} failed")
    print(f"Console errors: {len(console_errors)}")
    for e in console_errors[:10]:
        print('  ERR:', e[:200])
    sys.exit(1 if fails or console_errors else 0)


if __name__ == '__main__':
    main()
