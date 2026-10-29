(function (SF) {
    'use strict';

    const COLS = SF.COLS, ROWS = SF.ROWS, UNCLAIMED = SF.UNCLAIMED, CLAIMED = SF.CLAIMED;
    const STEP = 1 / 60;
    const PLAYER_SPEED = 46; // cells per second
    const FAST_SPEED = 70;
    const START_LIVES = 3;
    const EXTRA_LIFE_EVERY = 25000;

    const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const KEYS = {
        ArrowUp: 'up', KeyW: 'up',
        ArrowDown: 'down', KeyS: 'down',
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
    };

    function Game(canvas) {
        const params = new URLSearchParams(location.search);
        const seed = parseInt(params.get('seed'), 10);
        this.rng = SF.makeRng(isNaN(seed) ? (Date.now() >>> 0) : seed);
        this.field = new SF.Field(COLS, ROWS);
        this.renderer = new SF.Renderer(canvas);
        this.titlePicture = SF.paintPicture('sunset', 1);
        this.held = [];
        this.hi = parseInt(SF.store.get('sf.hi', '0'), 10) || 0;
        this.debug = { freeze: false, invincible: false };
        this.time = 0;
        this.state = 'title';
        this.stateT = 0;
        this.resetLevelState();
        this.level = SF.levelFor(0);
        this.score = 0;
        this.lives = START_LIVES;
        this.bindInput(canvas);
    }

    Game.prototype.resetLevelState = function () {
        this.player = { x: COLS >> 1, y: ROWS - 1, drawing: false, trail: [], startX: 0, startY: 0, acc: 1, fx: 0, fy: -1, invulnT: 0, ticks: 0 };
        this.minors = [];
        this.sparks = [];
        this.bullets = [];
        this.boxes = [];
        this.particles = [];
        this.texts = [];
        this.boss = null;
        this.speedT = this.freezeT = this.shieldT = this.slowT = 0;
    };

    Game.prototype.setState = function (s) {
        this.state = s;
        this.stateT = 0;
    };

    // ---- Starting games and sectors ------------------------------------------

    Game.prototype.startGame = function () {
        SF.sound.unlock();
        SF.sound.start();
        this.score = 0;
        this.lives = START_LIVES;
        this.nextLifeAt = EXTRA_LIFE_EVERY;
        this.newHi = false;
        this.startLevel(0);
    };

    Game.prototype.startLevel = function (index) {
        const rng = this.rng;
        this.levelIndex = index;
        this.level = SF.levelFor(index);
        this.field.reset();
        this.resetLevelState();
        this.picture = SF.paintPicture(this.level.picture, 100 + index);

        this.boss = new SF.Boss(this.level.boss, COLS / 2, ROWS / 2 - 10, rng, this.level);

        const p = this.player;
        const farFromStart = (x, y, d) => Math.hypot(x - p.x, y - p.y) > d;
        const farFromBoss = (x, y, d) => Math.hypot(x - this.boss.x, y - this.boss.y) > d;

        this.level.minors.forEach((type) => {
            let x, y, tries = 0;
            do {
                x = rng.range(12, COLS - 12);
                y = rng.range(12, ROWS - 12);
            } while ((!farFromStart(x, y, 40) || !farFromBoss(x, y, 18)) && ++tries < 100);
            this.minors.push(new SF.Minor(type, x, y, rng));
        });

        for (let i = 0; i < this.level.sparks; i++) {
            this.sparks.push(new SF.Spark(20 + i * 55, 0, i % 2 ? -1 : 1));
        }

        for (let i = 0; i < this.level.boxes; i++) {
            let x, y, tries = 0;
            do {
                x = rng.int(8, COLS - 9);
                y = rng.int(8, ROWS - 9);
            } while ((!farFromBoss(x, y, 14) || this.boxes.some((b) => Math.hypot(b.x - x, b.y - y) < 20)) && ++tries < 100);
            this.boxes.push({ x: x, y: y, power: SF.randomPower(rng) });
        }

        this.renderer.rebuild(this.field, this.picture);
        this.setState('intro');
    };

    // ---- Main loop ------------------------------------------------------------

    Game.prototype.update = function (dt) {
        this.time += dt;
        this.stateT += dt;

        if (this.state === 'intro' && this.stateT > 2.2) this.setState('play');
        else if (this.state === 'play') this.updatePlay(dt);
        else if (this.state === 'dying' && this.stateT > 1.6) this.afterDeath();
        else if (this.state === 'clear' && this.stateT > 4) this.startLevel(this.levelIndex + 1);

        if (this.state !== 'paused') {
            this.particles.forEach((pt) => {
                pt.x += pt.vx * dt;
                pt.y += pt.vy * dt;
                pt.life -= dt;
            });
            this.particles = this.particles.filter((pt) => pt.life > 0);
            this.texts.forEach((t) => { t.life -= dt * 0.8; });
            this.texts = this.texts.filter((t) => t.life > 0);
        }
    };

    Game.prototype.updatePlay = function (dt) {
        ['speedT', 'freezeT', 'shieldT', 'slowT'].forEach((k) => { this[k] = Math.max(0, this[k] - dt); });
        this.player.invulnT = Math.max(0, this.player.invulnT - dt);

        this.movePlayer(dt);
        if (this.state !== 'play') return;

        const frozen = this.freezeT > 0 || this.debug.freeze;
        this.mul = this.level.speed * (this.slowT > 0 ? 0.5 : 1);
        if (!frozen) {
            this.boss.update(dt, this);
            this.minors.forEach((m) => m.update(dt, this));
            this.sparks.forEach((s) => s.update(dt, this));
            this.bullets.forEach((b) => b.update(dt, this));
            this.bullets = this.bullets.filter((b) => !b.dead);
        }

        this.checkCollisions();
    };

    Game.prototype.vulnerable = function () {
        return this.player.invulnT <= 0 && this.shieldT <= 0 && !this.debug.invincible;
    };

    Game.prototype.checkCollisions = function () {
        if (!this.vulnerable()) return;
        const p = this.player;
        const px = p.x + 0.5, py = p.y + 0.5;

        for (const s of this.sparks) {
            if (Math.abs(s.x - p.x) <= 1 && Math.abs(s.y - p.y) <= 1) return this.die();
        }

        // Things inside the field can only hurt you while you're out drawing.
        if (!p.drawing) return;
        const hazards = this.boss.parts().concat(this.minors, this.bullets);
        for (const h of hazards) {
            if (Math.hypot(h.x - px, h.y - py) < h.r + 0.8) return this.die();
            if (this.field.scan(h.x, h.y, h.r, SF.TRAIL) > 0) return this.die();
        }
    };

    // ---- The player -----------------------------------------------------------

    Game.prototype.movePlayer = function (dt) {
        const p = this.player;
        const dir = this.held[this.held.length - 1];
        if (!dir) {
            p.acc = 1;
            return;
        }
        p.acc += (this.speedT > 0 ? FAST_SPEED : PLAYER_SPEED) * dt;
        while (p.acc >= 1 && this.state === 'play') {
            p.acc -= 1;
            if (!this.stepPlayer(DIRS[dir])) {
                p.acc = Math.min(p.acc, 1);
                break;
            }
        }
    };

    Game.prototype.stepPlayer = function (d) {
        const p = this.player, f = this.field;
        const nx = p.x + d[0], ny = p.y + d[1];
        p.fx = d[0];
        p.fy = d[1];
        if (!f.inBounds(nx, ny)) return false;
        const i = ny * COLS + nx;
        const v = f.cells[i];

        if (!p.drawing) {
            if (v === CLAIMED && f.edge[i]) {
                p.x = nx;
                p.y = ny;
                return true;
            }
            if (v !== UNCLAIMED) return false;
            p.drawing = true;
            p.startX = p.x;
            p.startY = p.y;
        } else if (v === SF.TRAIL) {
            return false; // no crossing or doubling back over your own line
        }

        p.x = nx;
        p.y = ny;
        if (v === CLAIMED) {
            this.closeLine();
            return true;
        }
        f.cells[i] = SF.TRAIL;
        p.trail.push(i);
        if (++p.ticks % 3 === 0) SF.sound.tick();

        // Boxed in by your own line with nowhere left to go.
        const open = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
            const v2 = f.get(p.x + dx, p.y + dy);
            return f.inBounds(p.x + dx, p.y + dy) && v2 !== SF.TRAIL;
        });
        if (!open) this.die(true);
        return true;
    };

    // The line has reached claimed ground: claim everything not on the boss's side.
    Game.prototype.closeLine = function () {
        const p = this.player, f = this.field;
        const res = f.close(p.trail, this.boss.x, this.boss.y);
        p.drawing = false;
        p.trail = [];

        const gained = res.captured + res.trail;
        let points = gained * 2;
        if (gained > f.interiorTotal * 0.1) {
            points *= 2;
            this.floatText(p.x, p.y - 4, 'BIG CLAIM x2', '#ffd166');
        }
        this.addScore(points);
        this.floatText(p.x, p.y, '+' + points, '#ffffff');
        SF.sound.claim(gained);

        const cellAt = (x, y) => f.get(Math.floor(x), Math.floor(y));
        this.minors = this.minors.filter((m) => {
            if (cellAt(m.x, m.y) !== CLAIMED) return true;
            this.explode(m.x, m.y, '#ff9ef0', 24);
            this.floatText(m.x, m.y, '+500', '#ff9ef0');
            this.addScore(500);
            SF.sound.kill();
            return false;
        });

        this.boxes = this.boxes.filter((b) => {
            if (f.get(b.x, b.y) !== CLAIMED) return true;
            this.applyPower(b);
            return false;
        });

        this.sparks.forEach((s) => s.snap(f));
        if (!f.isEdge(p.x, p.y)) {
            const e = f.nearestEdge(p.x, p.y);
            if (e !== -1) {
                p.x = e % COLS;
                p.y = (e / COLS) | 0;
            }
        }

        this.renderer.rebuild(f, this.picture);

        if (f.percent() >= this.level.target) this.levelCleared();
    };

    Game.prototype.applyPower = function (b) {
        const spec = SF.POWERS[b.power];
        this.floatText(b.x, b.y, spec.label, spec.colour);
        this.explode(b.x + 0.5, b.y + 0.5, spec.colour, 18);
        this.addScore(250);
        if (b.power === 'life') {
            this.lives++;
            SF.sound.life();
            return;
        }
        if (b.power === 'bomb') {
            this.minors.forEach((m) => {
                this.explode(m.x, m.y, '#ff9ef0', 24);
                this.addScore(500);
            });
            this.minors = [];
            this.bullets = [];
            SF.sound.kill();
            return;
        }
        this[b.power + 'T'] = spec.duration;
        SF.sound.power();
    };

    Game.prototype.levelCleared = function () {
        const extra = Math.floor(this.field.percent() - this.level.target);
        this.clearBonus = 1000 * this.level.number + extra * 250;
        this.addScore(this.clearBonus);
        this.bullets = [];
        SF.sound.clear();
        this.setState('clear');
    };

    // Being boxed in by your own line always costs a life, even with a shield.
    Game.prototype.die = function (trapped) {
        if (this.state !== 'play') return;
        const p = this.player;
        if (trapped && this.debug.invincible) {
            this.field.revertTrail(p.trail);
            p.trail = [];
            p.drawing = false;
            p.x = p.startX;
            p.y = p.startY;
            return;
        }
        if (!trapped && !this.vulnerable()) return;
        this.explode(p.x + 0.5, p.y + 0.5, '#7df9ff', 50);
        this.explode(p.x + 0.5, p.y + 0.5, '#ffd166', 30);
        if (trapped) this.floatText(p.x, p.y, 'TRAPPED!', '#ff4d6d');
        SF.sound.die();
        this.setState('dying');
    };

    Game.prototype.afterDeath = function () {
        const p = this.player;
        this.lives--;
        if (p.drawing) {
            this.field.revertTrail(p.trail);
            p.x = p.startX;
            p.y = p.startY;
        }
        p.drawing = false;
        p.trail = [];
        this.bullets = [];
        if (this.lives < 0) {
            this.lives = 0;
            this.newHi = this.score > this.hi;
            if (this.newHi) {
                this.hi = this.score;
                SF.store.set('sf.hi', this.hi);
            }
            SF.sound.gameOver();
            this.setState('over');
            return;
        }
        p.invulnT = 2.5;
        this.setState('play');
    };

    Game.prototype.addScore = function (n) {
        this.score += n;
        while (this.score >= this.nextLifeAt) {
            this.nextLifeAt += EXTRA_LIFE_EVERY;
            this.lives++;
            this.floatText(this.player.x, this.player.y - 8, 'EXTRA LIFE', '#80ff72');
            SF.sound.life();
        }
    };

    Game.prototype.explode = function (x, y, colour, count) {
        for (let i = 0; i < count; i++) {
            const a = this.rng() * Math.PI * 2, s = this.rng.range(5, 30);
            const life = this.rng.range(0.4, 1.1);
            this.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life, max: life, colour: colour });
        }
    };

    Game.prototype.floatText = function (x, y, text, colour) {
        this.texts.push({ x: x, y: y, text: text, colour: colour, life: 1.5 });
    };

    // ---- Input ---------------------------------------------------------------

    Game.prototype.bindInput = function (canvas) {
        window.addEventListener('keydown', (e) => {
            const dir = KEYS[e.code];
            if (dir) {
                e.preventDefault();
                this.held = this.held.filter((d) => d !== dir);
                this.held.push(dir);
                return;
            }
            if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                if (this.state === 'title') this.startGame();
                else if (this.state === 'over' && this.stateT > 1) this.setState('title');
            } else if (e.code === 'KeyP' || e.code === 'Escape') {
                this.togglePause();
            } else if (e.code === 'KeyM') {
                SF.sound.toggle();
            }
        });
        window.addEventListener('keyup', (e) => {
            const dir = KEYS[e.code];
            if (dir) this.held = this.held.filter((d) => d !== dir);
        });
        window.addEventListener('blur', () => {
            this.held = [];
            if (this.state === 'play') this.togglePause();
        });
        canvas.addEventListener('click', () => {
            if (this.state === 'title') this.startGame();
        });
    };

    Game.prototype.togglePause = function () {
        if (this.state === 'play') {
            this.setState('paused');
        } else if (this.state === 'paused') {
            this.held = [];
            this.setState('play');
        }
    };

    // ---- Boot ----------------------------------------------------------------

    const canvas = document.getElementById('game');
    const game = new Game(canvas);
    SF.game = game; // handy for the console and the smoke test

    let last = performance.now();
    let acc = 0;
    function frame(now) {
        acc += Math.min(0.25, (now - last) / 1000);
        last = now;
        while (acc >= STEP) {
            game.update(STEP);
            acc -= STEP;
        }
        game.renderer.draw(game);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})(window.SF);
