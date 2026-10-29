(function (SF) {
    'use strict';

    const CLAIMED = SF.CLAIMED;

    // Moves a round entity by its velocity, bouncing off claimed cells.
    // A move is allowed if it doesn't overlap more claimed cells than before, so an
    // entity left overlapping the wall after a claim can still wriggle free.
    SF.moveCircle = function (field, e, dt) {
        let bounced = false;
        const before = field.scan(e.x, e.y, e.r, CLAIMED);
        const nx = e.x + e.vx * dt;
        if (field.scan(nx, e.y, e.r, CLAIMED) > before) {
            e.vx = -e.vx;
            bounced = true;
        } else {
            e.x = nx;
        }
        const mid = field.scan(e.x, e.y, e.r, CLAIMED);
        const ny = e.y + e.vy * dt;
        if (field.scan(e.x, ny, e.r, CLAIMED) > mid) {
            e.vy = -e.vy;
            bounced = true;
        } else {
            e.y = ny;
        }
        return bounced;
    };

    function setSpeed(e, speed) {
        const cur = Math.hypot(e.vx, e.vy) || 1;
        e.vx = (e.vx / cur) * speed;
        e.vy = (e.vy / cur) * speed;
    }

    function diagonal(rng, speed) {
        const a = rng.int(0, 3) * (Math.PI / 2) + Math.PI / 4 + rng.range(-0.35, 0.35);
        return [Math.cos(a) * speed, Math.sin(a) * speed];
    }

    function steerTowards(e, tx, ty, turnRate, dt) {
        const want = Math.atan2(ty - e.y, tx - e.x);
        const cur = Math.atan2(e.vy, e.vx);
        let diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const a = cur + SF.clamp(diff, -turnRate * dt, turnRate * dt);
        const s = Math.hypot(e.vx, e.vy);
        e.vx = Math.cos(a) * s;
        e.vy = Math.sin(a) * s;
    }

    // ---- Small enemies -------------------------------------------------------
    //   drifter - straight diagonal lines, bouncing off walls
    //   zigzag  - fast sideways, flips up/down on a fixed beat
    //   looper  - travels in steady circles
    //   seeker  - slow, but turns towards you while you're drawing

    const MINORS = {
        drifter: { r: 2.2, speed: 17 },
        zigzag: { r: 2.2, speed: 20 },
        looper: { r: 2.2, speed: 16 },
        seeker: { r: 2.4, speed: 11 },
    };

    function Minor(type, x, y, rng) {
        const spec = MINORS[type];
        this.kind = 'minor';
        this.type = type;
        this.x = x;
        this.y = y;
        this.r = spec.r;
        this.speed = spec.speed;
        this.t = 0;
        this.spin = 0;
        const v = diagonal(rng, spec.speed);
        this.vx = v[0];
        this.vy = v[1];
        if (type === 'zigzag') {
            this.vx = (rng() < 0.5 ? -1 : 1) * spec.speed * 0.85;
            this.vy = spec.speed * 0.5;
        }
        this.turn = rng() < 0.5 ? -1.6 : 1.6;
    }

    Minor.prototype.update = function (dt, g) {
        this.t += dt;
        this.spin += dt * 4;
        if (this.type === 'zigzag' && this.t > 0.7) {
            this.t = 0;
            this.vy = -this.vy;
        } else if (this.type === 'looper') {
            const a = Math.atan2(this.vy, this.vx) + this.turn * dt;
            this.vx = Math.cos(a);
            this.vy = Math.sin(a);
        } else if (this.type === 'seeker' && g.player.drawing) {
            steerTowards(this, g.player.x + 0.5, g.player.y + 0.5, 1.6, dt);
        }
        setSpeed(this, this.speed * g.mul);
        SF.moveCircle(g.field, this, dt);
    };

    Minor.prototype.parts = function () {
        return [this];
    };

    // ---- Bosses ------------------------------------------------------------
    // One per sector. The pocket the boss is in is the one that stays unclaimed.
    //   orb     - big and slow, bounces like a drifter
    //   serpent - a head trailing a long body; every segment is dangerous
    //   spinner - drifts slowly and fires rings of bullets
    //   hunter  - wanders, then chases you while you're drawing

    function Boss(type, x, y, rng, level) {
        this.kind = 'boss';
        this.type = type;
        this.x = x;
        this.y = y;
        this.t = 0;
        this.spin = 0;
        const v = diagonal(rng, 1);
        this.vx = v[0];
        this.vy = v[1];
        this.rng = rng;
        if (type === 'orb') {
            this.r = 7;
            this.speed = 11;
        } else if (type === 'serpent') {
            this.r = 4.5;
            this.speed = 15;
            this.segments = 12 + level.loop * 3;
            this.history = [];
            for (let i = 0; i < this.segments * 3 + 1; i++) this.history.push({ x: x, y: y });
            this.body = [];
        } else if (type === 'spinner') {
            this.r = 6;
            this.speed = 8;
            this.fireEvery = level.number >= 7 ? 2.2 : 2.8;
            this.shots = level.number >= 7 ? 12 : 8;
            this.fireT = 2;
            this.offset = 0;
        } else {
            this.r = 5.5;
            this.speed = 10;
            this.chase = 17;
        }
    }

    Boss.prototype.update = function (dt, g) {
        this.t += dt;
        this.spin += dt * 2;
        let speed = this.speed;

        if (this.type === 'serpent') {
            const a = Math.atan2(this.vy, this.vx) + Math.sin(this.t * 1.1) * 1.5 * dt;
            this.vx = Math.cos(a);
            this.vy = Math.sin(a);
        } else if (this.type === 'spinner') {
            this.fireT -= dt * g.mul;
            if (this.fireT <= 0) {
                this.fireT = this.fireEvery;
                this.offset += Math.PI / this.shots;
                for (let i = 0; i < this.shots; i++) {
                    const a = this.offset + (i / this.shots) * Math.PI * 2;
                    g.bullets.push(new Bullet(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, a, 18));
                }
                SF.sound.shoot();
            }
        } else if (this.type === 'hunter') {
            if (g.player.drawing) {
                speed = this.chase;
                steerTowards(this, g.player.x + 0.5, g.player.y + 0.5, 1.9, dt);
            } else if (this.rng() < 0.02) {
                const a = Math.atan2(this.vy, this.vx) + this.rng.range(-0.8, 0.8);
                this.vx = Math.cos(a);
                this.vy = Math.sin(a);
            }
        }

        setSpeed(this, speed * g.mul);
        SF.moveCircle(g.field, this, dt);

        if (this.type === 'serpent') {
            const last = this.history[this.history.length - 1];
            if (Math.hypot(this.x - last.x, this.y - last.y) >= 1) {
                this.history.push({ x: this.x, y: this.y });
                if (this.history.length > this.segments * 3 + 1) this.history.shift();
            }
            this.body = [];
            for (let i = 1; i <= this.segments; i++) {
                const p = this.history[Math.max(0, this.history.length - 1 - i * 3)];
                this.body.push({ x: p.x, y: p.y, r: 3.2 - (i / this.segments) * 1.2 });
            }
        }
    };

    // Every circle that hurts on contact.
    Boss.prototype.parts = function () {
        return this.type === 'serpent' ? [this].concat(this.body) : [this];
    };

    // ---- Bullets -------------------------------------------------------------

    function Bullet(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.r = 0.8;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.dead = false;
    }

    Bullet.prototype.update = function (dt, g) {
        this.x += this.vx * dt * g.mul;
        this.y += this.vy * dt * g.mul;
        if (g.field.scan(this.x, this.y, this.r, CLAIMED) > 0) this.dead = true;
    };

    // ---- Sparks --------------------------------------------------------------
    // Patrol the edge. Each one keeps to one hand (left or right) at junctions, and
    // remembers its last few cells so it can't get stuck circling a thick corner.

    function Spark(x, y, hand) {
        this.kind = 'spark';
        this.x = x;
        this.y = y;
        this.dx = 1;
        this.dy = 0;
        this.hand = hand;
        this.acc = 0;
        this.speed = 20;
        this.recent = [];
    }

    Spark.prototype.update = function (dt, g) {
        this.acc += this.speed * g.mul * dt;
        while (this.acc >= 1) {
            this.acc -= 1;
            this.step(g.field);
        }
    };

    Spark.prototype.step = function (field) {
        const dx = this.dx, dy = this.dy;
        const left = [dy, -dx], right = [-dy, dx], ahead = [dx, dy], back = [-dx, -dy];
        const order = this.hand > 0 ? [left, ahead, right, back] : [right, ahead, left, back];
        let chosen = null, fallback = null;
        for (const d of order) {
            const nx = this.x + d[0], ny = this.y + d[1];
            if (!field.isEdge(nx, ny)) continue;
            if (!fallback) fallback = d;
            if (this.recent.indexOf(ny * field.cols + nx) === -1) {
                chosen = d;
                break;
            }
        }
        const d = chosen || fallback;
        if (!d) return;
        this.x += d[0];
        this.y += d[1];
        this.dx = d[0];
        this.dy = d[1];
        this.recent.push(this.y * field.cols + this.x);
        if (this.recent.length > 6) this.recent.shift();
    };

    Spark.prototype.snap = function (field) {
        if (field.isEdge(this.x, this.y)) return;
        const i = field.nearestEdge(this.x, this.y);
        if (i === -1) return;
        this.x = i % field.cols;
        this.y = (i / field.cols) | 0;
        this.recent = [];
    };

    // ---- Mystery boxes -------------------------------------------------------
    // Claim the area a box sits in to open it.

    SF.POWERS = {
        speed: { label: 'SPEED UP', colour: '#4cc9f0', weight: 3, duration: 10 },
        freeze: { label: 'FREEZE', colour: '#a5f3fc', weight: 3, duration: 6 },
        shield: { label: 'SHIELD', colour: '#ffd166', weight: 2, duration: 8 },
        slow: { label: 'SLOW ENEMIES', colour: '#b8f2e6', weight: 3, duration: 10 },
        bomb: { label: 'SMART BOMB', colour: '#ff6b6b', weight: 2, duration: 0 },
        life: { label: 'EXTRA LIFE', colour: '#80ff72', weight: 1, duration: 0 },
    };

    SF.randomPower = function (rng) {
        const names = Object.keys(SF.POWERS);
        let total = 0;
        names.forEach((n) => { total += SF.POWERS[n].weight; });
        let roll = rng() * total;
        for (const n of names) {
            roll -= SF.POWERS[n].weight;
            if (roll < 0) return n;
        }
        return names[0];
    };

    SF.Minor = Minor;
    SF.Boss = Boss;
    SF.Bullet = Bullet;
    SF.Spark = Spark;
})(window.SF);
