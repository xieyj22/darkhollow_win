# In-game verification for feat/batch2-highvalue (批2「高性价比」).
# Runs against the Vite DEV server so page.evaluate can `import('/src/*.ts')`
# and get the SAME live module instances the game loop uses — the checks below
# exercise the real wiring (enemy skill handlers, event sites, item-intro DOM,
# i18n, sprites, boss reveal, shrine/fountain tiles), not unit mocks.
#   1-3  three revived caster enemies (heal / summon / blink) fire live
#   4    boss instance carries a skill + melee-range cast gate
#   5    F5 event-site placement (forced roll) -> popup -> action -> eventFlags
#   6    first corruption tier-crossing opens the mechanic intro card
#   7    setLang tracks document.documentElement.lang
#   8    spriteKind routing + PORTAL template shape
#   9    checkBossReveal one-shot on first sight
#   10   shrine 20% blessing + cleanse-direction (green, message) fx
# Run: npm run dev -- --port 5173 --strictPort, then:
#      python scripts/verify_batch2_ingame.py
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
        # favicon 404s are dev-server noise (see verify_reconnect_ingame.py).
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and 'favicon' not in (m.location or {}).get('url', '') else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.goto(BASE)
        page.wait_for_timeout(1200)
        start_game(page)

        # ============ 1-3: revived casters fire live ============
        print('[1-3] caster enemies: heal / summon / blink (live handlers)')
        casters = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const d = await import('/src/data.ts');
            const fac = await import('/src/enemy-factory.ts');
            const es = await import('/src/enemy-skills.ts');
            const p = st.G.player, out = {};

            // 1. Deep Mender heals a wounded comrade.
            const menderDef = d.ENEMIES.find(e => e.n.en === 'Deep Mender');
            const mender = fac.makeEnemy(menderDef, p.x + 1, p.y, 1);
            const hurt = fac.makeEnemy(menderDef, p.x + 1, p.y + 1, 1);
            hurt.hp = Math.floor(hurt.maxHp * 0.2);
            const hpBefore = hurt.hp;
            st.G.enemies = [mender, hurt];
            es.executeEnemySkill(mender, menderDef.skill);
            out.healDelta = hurt.hp - hpBefore;

            // 2. Crypt Summoner raises a dead.
            const summonDef = d.ENEMIES.find(e => e.n.en === 'Crypt Summoner');
            const summoner = fac.makeEnemy(summonDef, p.x + 1, p.y, 1);
            st.G.enemies = [summoner];
            es.executeEnemySkill(summoner, summonDef.skill);
            out.summonAdds = st.G.enemies.length - 1;

            // 3. Void Blinker teleports next to the player.
            const blinkDef = d.ENEMIES.find(e => e.n.en === 'Void Blinker');
            const blinker = fac.makeEnemy(blinkDef, p.x + 6, p.y, 1);
            st.G.enemies = [blinker];
            es.executeEnemySkill(blinker, blinkDef.skill);
            out.blinkDx = Math.abs(blinker.x - p.x);
            out.blinkDy = Math.abs(blinker.y - p.y);

            st.G.enemies = [];
            return out;
        }""")
        check('1 Deep Mender Mending Tide heals wounded comrade', casters['healDelta'] > 0,
              f"hp +{casters['healDelta']}")
        check('2 Crypt Summoner Raise Dead adds an enemy', casters['summonAdds'] >= 1,
              f"adds={casters['summonAdds']}")
        check('3 Void Blinker Void Step lands adjacent to player',
              max(casters['blinkDx'], casters['blinkDy']) <= 1,
              f"dx={casters['blinkDx']} dy={casters['blinkDy']}")

        # ============ 4: boss skill + melee cast gate ============
        print('[4] boss instance skill + melee-range gate')
        gate = page.evaluate("""async () => {
            const d = await import('/src/data.ts');
            const fac = await import('/src/enemy-factory.ts');
            const en = await import('/src/enemies.ts');
            const st = await import('/src/state.ts');
            const bd = d.BOSSES.find(b => b.skill);
            const p = st.G.player;
            const boss = fac.makeEnemy(bd, p.x + 1, p.y, 1, { isBoss: true });
            st.G.enemies = [boss];
            st.G.player.visible[boss.y][boss.x] = true;   // boss sees / is seen
            // The priority gate sits in processEnemies BEFORE the melee branch:
            // with the chance roll forced to pass, an adjacent boss must CAST
            // (skillCd set to the skill cd) instead of taking a melee swing.
            const orig = Math.random;
            Math.random = () => 0;
            en.processEnemies();
            Math.random = orig;
            const castAtMelee = boss.skillCd === bd.skill.cd;
            st.G.enemies = [];
            return { name: bd.n.en, hasSkill: !!boss.skill, effect: boss.skill?.effect,
                     castAtMelee, skillCd: boss.skillCd };
        }""")
        check('4 boss instance carries its skill', gate['hasSkill'],
              f"{gate['name']}: {gate['effect']}")
        check('4 adjacent boss casts via priority gate (not melee)',
              gate['castAtMelee'], f"skillCd={gate['skillCd']}")

        # ============ 5: F5 event site placement -> popup -> flag ============
        print('[5] event site: entity on map + popup action + eventFlags')
        # enterFloor(5) with skipFade (synchronous setup). NOTE: forcing
        # Math.random to a constant here is counterproductive — genDungeon's
        # room placement goes fully deterministic and collapses to a single
        # room, which starves rooms.slice(1) and skips ALL npc placement. The
        # 28% placement gate itself is unit-tested (batch2 event-sites tests);
        # this check verifies the live popup->action->flag chain, so enter with
        # real randomness and inject an event entity only if none was placed.
        placed = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const g = await import('/src/game.ts');
            const i18n = await import('/src/i18n.ts');
            g.enterFloor(5, true);
            let ent = st.G.items.find(i => i.npc === 'event');
            if (!ent) {
                const p = st.G.player;
                ent = { type: 'consumable', name: i18n.t('ev2.cursed_altarTitle'), ch: '⛧', c: '#c0392b',
                        desc: '', x: p.x, y: p.y, rarity: 2, npc: 'event', eventId: 'cursed_altar' };
                st.G.items.push(ent);
            }
            return { eventId: ent.eventId, x: ent.x, y: ent.y };
        }""")
        check('5 F5 event-site entity on the map (natural or injected)', placed is not None,
              f"site={placed['eventId'] if placed else None}")
        if placed:
            page.evaluate("""async (ev) => {
                const st = await import('/src/state.ts');
                const events = await import('/src/events.ts');
                const ent = st.G.items.find(i => i.npc === 'event');
                events.triggerNpc(ent);
            }""", placed['eventId'])
            page.wait_for_timeout(150)
            popup_visible = page.evaluate(
                "document.getElementById('event-popup')?.style.display === 'block'")
            check('5 event popup opens via triggerNpc', popup_visible)
            page.click('#event-popup .evb')   # first button = site action
            page.wait_for_timeout(150)
            flag = page.evaluate("""async (ev) => {
                const st = await import('/src/state.ts');
                return !!st.G.eventFlags?.[ev];
            }""", placed['eventId'])
            check('5 eventFlags set after choosing the action', flag,
                  f"eventFlags[{placed['eventId']}]")

        # ============ 6: first corruption crossing opens the intro card ============
        print('[6] corruption mechanic card on first tier crossing')
        page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const cb = await import('/src/combat.ts');
            st.G.player.corruption = 19;
            cb.applyCorruption(1);           // 19 -> 20 crosses clean -> touched
        }""")
        page.wait_for_timeout(300)
        card = page.evaluate(
            "document.getElementById('item-intro-content')?.innerHTML ?? ''")
        check('6 corruption intro card renders on first crossing',
              'intro.mcCorruptionTitle' in card or 'Corruption' in card or '腐化' in card,
              f"card_len={len(card)}")

        # ============ 7: setLang tracks <html lang> ============
        print('[7] setLang -> documentElement.lang')
        lang_ok = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            st.setLang('zh');
            const zh = document.documentElement.lang;
            st.setLang('en');
            return { zh, back: document.documentElement.lang };
        }""")
        check('7 <html lang> follows setLang', lang_ok['zh'] == 'zh' and lang_ok['back'] == 'en',
              str(lang_ok))

        # ============ 8: spriteKind routing + PORTAL shape ============
        print('[8] sprite routing + PORTAL template')
        spr = page.evaluate("""async () => {
            const sp = await import('/src/sprites.ts');
            const r = sp.pickItemTemplate({ type: 'consumable', spriteKind: 'CHEST', name: 'x', rarity: 2 });
            const portal = sp.TEMPLATES.PORTAL;
            return { key: r.key, rows: portal.length, widths: [...new Set(portal.map(row => row.length))] };
        }""")
        check('8 spriteKind CHEST routes to CHEST template', spr['key'] == 'CHEST', spr['key'])
        check('8 PORTAL template 16x16', spr['rows'] == 16 and spr['widths'] == [16],
              f"rows={spr['rows']} widths={spr['widths']}")

        # ============ 9: boss reveal one-shot on first sight ============
        print('[9] checkBossReveal fires once on first sight')
        reveal = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const d = await import('/src/data.ts');
            const fac = await import('/src/enemy-factory.ts');
            const en = await import('/src/enemies.ts');
            const p = st.G.player;
            const bd = d.BOSSES.find(b => b.skill);
            const boss = fac.makeEnemy(bd, p.x + 1, p.y, 1, { isBoss: true });
            const hidden = fac.makeEnemy(bd, p.x + 15, p.y, 1, { isBoss: true });  // beyond FOV
            st.G.enemies = [boss, hidden];
            st.G.player.visible[boss.y][boss.x] = true;      // seen
            st.G.player.visible[hidden.y][hidden.x] = false; // explicitly unseen
            // hidden stays outside visible
            en.checkBossReveal();
            const first = boss.introPlayed === true;
            en.checkBossReveal();                            // idempotent
            return { first, idempotent: boss.introPlayed === true && !hidden.introPlayed,
                     hidden: hidden.introPlayed };
        }""")
        check('9 seen boss flips introPlayed', reveal['first'], str(reveal))
        check('9 second call no-ops; unseen boss untouched', reveal['idempotent'] and reveal['hidden'] is None,
              str(reveal))
        page.evaluate("async () => { const st = await import('/src/state.ts'); st.G.enemies = []; }")

        # ============ 10: shrine blessing + cleanse-direction fx ============
        print('[10] shrine 20% blessing + cleanse direction (message observable)')
        polish = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const cfg = await import('/src/config.ts');
            const ev = await import('/src/events.ts');
            const p = st.G.player, out = {};
            // (a) blessing: force Math.random < 0.2
            st.G.dungeon.map[p.y][p.x] = cfg.TL.SHRINE;
            const before = { atk: p.baseAtk, def: p.baseDef, hp: p.baseMaxHp };
            const orig = Math.random;
            Math.random = () => 0.1;
            ev.checkTiles();
            Math.random = orig;
            out.atk = p.baseAtk - before.atk; out.def = p.baseDef - before.def; out.maxHp = p.baseMaxHp - before.hp;
            // (b) cleanse crossing: fountain -15 from 55 -> 40 (corrupted -> touched)
            st.G.dungeon.map[p.y][p.x] = cfg.TL.FOUNTAIN;
            p.corruption = 55; p.hp = p.maxHp;
            ev.checkTiles();
            out.corruption = p.corruption;
            out.tileAfter = st.G.dungeon.map[p.y][p.x];
            out.water = cfg.TL.WATER;
            return out;
        }""")
        check('10 shrine powerful blessing +2/+2/+10',
              polish['atk'] == 2 and polish['def'] == 2 and polish['maxHp'] == 10,
              f"atk+{polish['atk']} def+{polish['def']} maxHp+{polish['maxHp']}")
        msg_ok = ('powerful blessing' in log_text(page)) or ('强大的祝福' in log_text(page))
        check('10 shrineBuff message in log', msg_ok)
        check('10 fountain cleanse crosses 55 -> 40', polish['corruption'] == 40,
              f"corruption={polish['corruption']}")
        clean_msg = ('corruption recedes' in log_text(page)) or ('腐化退去' in log_text(page))
        check('10 cleanse reads as relief (green message, not the gain shake line)', clean_msg)

        browser.close()

    fails = [r for r in results if not r[1]]
    print(f"\nTotal {len(results)} checks, {len(fails)} failed")
    print(f"Console errors: {len(console_errors)}")
    for e in console_errors[:10]:
        print('  ERR:', e[:200])
    sys.exit(1 if fails or console_errors else 0)


if __name__ == '__main__':
    main()
