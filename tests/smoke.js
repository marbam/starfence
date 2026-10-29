// Smoke test: drives the real game in headless Chrome and saves screenshots to tests/shots/.
// Run with `npm test`. Uses ?seed=1 so the run is repeatable.
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const out = (n) => path.join(__dirname, 'shots', n + '.png');
const indexUrl = require('url').pathToFileURL(path.join(__dirname, '..', 'index.html')).href + '?seed=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(ok, label, detail) {
    console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail !== undefined ? ' (' + detail + ')' : ''));
    if (!ok) failures++;
}

(async () => {
    fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
    const browser = await puppeteer.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(indexUrl);
    await page.evaluate(() => localStorage.clear());
    await sleep(600);
    await page.screenshot({ path: out('01-title') });

    const game = (fn, arg) => page.evaluate(fn, arg);
    const state = () => game(() => SF.game.state);

    // Start a game.
    await page.keyboard.press('Enter');
    await sleep(300);
    check(await state() === 'intro', 'Enter starts sector 1');
    await page.screenshot({ path: out('02-intro') });
    await sleep(2300);
    check(await state() === 'play', 'intro hands over to play');

    // Freeze enemies so the scripted moves below aren't interrupted.
    await game(() => { SF.game.debug.freeze = true; });

    // Real key presses move the ship along the bottom edge.
    const before = await game(() => ({ x: SF.game.player.x, y: SF.game.player.y }));
    await page.keyboard.down('ArrowLeft');
    await sleep(300);
    await page.keyboard.up('ArrowLeft');
    const after = await game(() => ({ x: SF.game.player.x, y: SF.game.player.y, edge: SF.game.field.isEdge(SF.game.player.x, SF.game.player.y) }));
    check(after.x < before.x && after.y === before.y && after.edge, 'arrow key moves along the edge', before.x + ' -> ' + after.x);

    // Draw a 40x30 box off the bottom edge.
    const claim = await game(() => {
        const g = SF.game;
        const steps = (dx, dy, n) => { for (let i = 0; i < n; i++) g.stepPlayer([dx, dy]); };
        steps(0, -1, 30);
        const drawing = g.player.drawing && g.player.trail.length === 30;
        steps(1, 0, 40);
        steps(0, 1, 30);
        return { drawing, pct: g.field.percent(), stillDrawing: g.player.drawing, onEdge: g.field.isEdge(g.player.x, g.player.y), score: g.score };
    });
    check(claim.drawing, 'moving into the field starts a line');
    check(!claim.stillDrawing && claim.onEdge, 'joining the edge finishes the line, ship back on the edge');
    check(claim.pct > 6 && claim.pct < 7.5, 'box claims about 6.5% of the field', claim.pct.toFixed(2));
    check(claim.score > 0, 'claiming scores points', claim.score);
    await sleep(100);
    await page.screenshot({ path: out('03-first-claim') });

    // Can't double back over your own line.
    const noReverse = await game(() => {
        const g = SF.game;
        for (let i = 0; i < 8; i++) g.stepPlayer([1, 0]);
        g.stepPlayer([0, -1]);
        g.stepPlayer([0, -1]);
        if (!g.player.drawing) return { moved: true, sameY: false };
        const y = g.player.y;
        const moved = g.stepPlayer([0, 1]);
        return { moved, sameY: g.player.y === y };
    });
    check(!noReverse.moved && noReverse.sameY, 'ship cannot reverse onto its own line');

    // An enemy touching the line costs a life and removes the line.
    const lives = await game(() => SF.game.lives);
    await game(() => {
        const g = SF.game;
        const i = g.player.trail[0];
        const m = g.minors[0];
        m.x = (i % SF.COLS) + 0.5;
        m.y = Math.floor(i / SF.COLS) + 0.5;
        g.checkCollisions();
    });
    check(await state() === 'dying', 'enemy touching the line kills you');
    await sleep(150);
    await page.screenshot({ path: out('04-death') });
    await sleep(1800);
    const afterDeath = await game(() => {
        const g = SF.game;
        return { state: g.state, lives: g.lives, trailCells: Array.from(g.field.cells).filter((v) => v === SF.TRAIL).length, onEdge: g.field.isEdge(g.player.x, g.player.y) };
    });
    check(afterDeath.state === 'play' && afterDeath.lives === lives - 1, 'lose one life and carry on', afterDeath.lives);
    check(afterDeath.trailCells === 0 && afterDeath.onEdge, 'line removed and ship back where it started');

    // Claim almost everything directly, then finish with one real line to clear the sector.
    const cleared = await game(() => {
        const g = SF.game, f = g.field;
        g.minors.forEach((m) => { m.x = 80; m.y = 60; });
        g.boss.x = 80; g.boss.y = 60;
        let added = 0;
        for (let y = 1; y < SF.ROWS - 1; y++) {
            for (let x = 1; x < SF.COLS - 1; x++) {
                const inside = x >= 50 && x < 110 && y >= 30 && y < 90;
                const i = y * SF.COLS + x;
                if (!inside && f.cells[i] === SF.UNCLAIMED) { f.cells[i] = SF.CLAIMED; added++; }
            }
        }
        f.claimedInterior += added;
        f.computeEdges();
        g.renderer.rebuild(f, g.picture);
        g.player.x = 55; g.player.y = 90;
        const ok = f.isEdge(55, 90);
        [[0, -1], [0, -1], [0, -1], [-1, 0], [0, 1], [0, 1], [0, 1]].forEach((d) => g.stepPlayer(d));
        return { ok, state: g.state, pct: f.percent() };
    });
    check(cleared.ok && cleared.state === 'clear', 'reaching the target clears the sector', cleared.pct.toFixed(1) + "%");
    await sleep(2500);
    await page.screenshot({ path: out('05-sector-clear') });
    await sleep(2000);
    check(await game(() => SF.game.state === 'intro' && SF.game.level.number === 2), 'next sector starts');

    // A screenshot of each sector mid-game, and of each finished picture.
    const levels = await game(() => SF.LEVELS.length);
    for (let i = 0; i < levels; i++) {
        await game((n) => {
            const g = SF.game;
            g.debug.freeze = false;
            g.startLevel(n);
            g.setState('play');
            for (let k = 0; k < 120; k++) g.update(1 / 60);
        }, i);
        await sleep(80);
        await page.screenshot({ path: out('1' + i + '-sector-' + (i + 1)) });
        await game(() => { SF.game.setState('clear'); SF.game.stateT = 3; });
        await sleep(80);
        await page.screenshot({ path: out('2' + i + '-picture-' + (i + 1)) });
    }

    // Monkey test: random moves at high speed in every sector, with the ship invincible,
    // checking the field stays consistent after every claim.
    const monkey = await game((count) => {
        const g = SF.game, f = g.field;
        const dirs = ['up', 'down', 'left', 'right'];
        const report = { claims: 0, problems: [], maxPct: [] };
        g.debug.invincible = true;
        const origClose = g.closeLine.bind(g);
        g.closeLine = function () {
            origClose();
            report.claims++;
            const p = g.player;
            if (!f.isEdge(p.x, p.y)) report.problems.push('ship off edge after claim');
            if (Array.from(f.cells).some((v) => v === SF.TRAIL)) report.problems.push('trail left behind');
            g.sparks.forEach((s) => { if (!f.isEdge(s.x, s.y)) report.problems.push('spark off edge'); });
            if (f.get(Math.floor(g.boss.x), Math.floor(g.boss.y)) === SF.CLAIMED && f.percent() < 99) {
                // Fine if the boss is only overlapping a wall; it must still be next to open space.
                if (f.scan(g.boss.x, g.boss.y, g.boss.r + 1, SF.UNCLAIMED) === 0) report.problems.push('boss buried');
            }
        };
        for (let n = 0; n < count; n++) {
            g.startLevel(n);
            g.setState('play');
            let best = 0;
            for (let k = 0; k < 60 * 90 && g.state === 'play'; k++) {
                if (k % 25 === 0) g.held = [dirs[Math.floor(g.rng() * 4)]];
                g.update(1 / 60);
                best = Math.max(best, f.percent());
            }
            report.maxPct.push(Math.round(best) + '%/' + g.state);
        }
        g.closeLine = origClose;
        g.held = [];
        g.debug.invincible = false;
        return report;
    }, levels);
    check(monkey.claims > 20, 'monkey made lots of claims', monkey.claims);
    check(monkey.problems.length === 0, 'field stayed consistent', monkey.problems.slice(0, 5).join('; '));
    console.log('     monkey best % per sector: ' + monkey.maxPct.join(' '));

    // Not invincible: random play should end in game over, and save the high score.
    const over = await game(() => {
        const g = SF.game;
        const dirs = ['up', 'down', 'left', 'right'];
        g.startGame();
        for (let k = 0; k < 60 * 600 && g.state !== 'over'; k++) {
            if (g.state === 'intro') g.setState('play');
            if (k % 25 === 0) g.held = [dirs[Math.floor(g.rng() * 4)]];
            g.update(1 / 60);
        }
        g.held = [];
        return { state: g.state, score: g.score, hi: localStorage.getItem('sf.hi') };
    });
    check(over.state === 'over', 'random play ends in game over', over.state);
    check(over.hi === String(over.score), 'high score saved', over.hi);
    await sleep(1200);
    await page.screenshot({ path: out('30-game-over') });
    await page.keyboard.press('Enter');
    await sleep(200);
    check(await state() === 'title', 'Enter on game over returns to title');

    check(errors.length === 0, 'no page errors', errors.join(' | '));
    await browser.close();
    console.log(failures ? failures + ' check(s) failed' : 'All checks passed');
    process.exit(failures ? 1 : 0);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
