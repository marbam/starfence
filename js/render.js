(function (SF) {
    'use strict';

    const CELL = SF.CELL, COLS = SF.COLS, ROWS = SF.ROWS, W = SF.W, FIELD_H = SF.FIELD_H, HUD_H = SF.HUD_H;
    const PAD = SF.PAD, CW = SF.CW, CH = SF.CH;
    const FONT = 'Consolas, "Courier New", monospace';

    function makeSpace() {
        const c = SF.makeCanvas(W, FIELD_H);
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
        g.addColorStop(0, '#05060f');
        g.addColorStop(1, '#0d1030');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, FIELD_H);
        ctx.fillStyle = 'rgba(90,120,255,0.07)';
        for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 1, FIELD_H);
        for (let y = 0; y < FIELD_H; y += 16) ctx.fillRect(0, y, W, 1);
        const rng = SF.makeRng(7);
        for (let i = 0; i < 140; i++) {
            ctx.fillStyle = 'rgba(200,210,255,' + rng.range(0.15, 0.6).toFixed(2) + ')';
            ctx.fillRect(Math.floor(rng() * W), Math.floor(rng() * FIELD_H), 1, 1);
        }
        return c;
    }

    function Renderer(canvas) {
        this.ctx = canvas.getContext('2d');
        this.space = makeSpace();
        this.mask = SF.makeCanvas(COLS, ROWS);
        this.edges = SF.makeCanvas(COLS, ROWS);
        this.reveal = SF.makeCanvas(W, FIELD_H);
    }

    // Redraws the claimed picture and the edge line. Only needed after the field changes.
    Renderer.prototype.rebuild = function (field, picture) {
        const mctx = this.mask.getContext('2d');
        const ectx = this.edges.getContext('2d');
        const mImg = mctx.createImageData(COLS, ROWS);
        const eImg = ectx.createImageData(COLS, ROWS);
        for (let i = 0; i < field.cells.length; i++) {
            if (field.cells[i] === SF.CLAIMED) mImg.data[i * 4 + 3] = 255;
            if (field.edge[i]) {
                eImg.data[i * 4] = 110;
                eImg.data[i * 4 + 1] = 235;
                eImg.data[i * 4 + 2] = 255;
                eImg.data[i * 4 + 3] = 210;
            }
        }
        mctx.putImageData(mImg, 0, 0);
        ectx.putImageData(eImg, 0, 0);

        const r = this.reveal.getContext('2d');
        r.imageSmoothingEnabled = false;
        r.globalCompositeOperation = 'source-over';
        r.clearRect(0, 0, W, FIELD_H);
        r.drawImage(picture, 0, 0);
        r.globalCompositeOperation = 'destination-in';
        r.drawImage(this.mask, 0, 0, W, FIELD_H);
        r.globalCompositeOperation = 'source-over';
        r.drawImage(this.edges, 0, 0, W, FIELD_H);
    };

    Renderer.prototype.text = function (str, x, y, size, colour, align) {
        const ctx = this.ctx;
        ctx.font = 'bold ' + size + 'px ' + FONT;
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(str, x + 2, y + 2);
        ctx.fillStyle = colour;
        ctx.fillText(str, x, y);
    };

    Renderer.prototype.draw = function (g) {
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CW, CH);

        if (g.state === 'title') {
            this.drawTitle(g);
            return;
        }

        this.drawHud(g);
        ctx.save();
        ctx.translate(PAD, HUD_H);
        ctx.beginPath();
        ctx.rect(-PAD, 0, W + PAD * 2, FIELD_H + PAD);
        ctx.clip();

        ctx.drawImage(this.space, 0, 0);
        ctx.drawImage(this.reveal, 0, 0);
        if (g.state === 'clear') {
            ctx.globalAlpha = Math.min(1, g.stateT * 0.8);
            ctx.drawImage(g.picture, 0, 0);
            ctx.globalAlpha = 1;
        }

        // The line being drawn.
        const p = g.player;
        if (p.trail.length) {
            ctx.fillStyle = Math.floor(g.time * 12) % 2 ? '#fff275' : '#ffb703';
            for (const i of p.trail) ctx.fillRect((i % COLS) * CELL, ((i / COLS) | 0) * CELL, CELL, CELL);
        }

        if (g.state !== 'clear') {
            g.boxes.forEach((b) => this.drawBox(b, g));
            g.minors.forEach((m) => this.drawMinor(m, g));
            if (g.boss) this.drawBoss(g.boss, g);
            ctx.fillStyle = '#ff4d6d';
            g.bullets.forEach((b) => {
                ctx.beginPath();
                ctx.arc(b.x * CELL, b.y * CELL, b.r * CELL, 0, Math.PI * 2);
                ctx.fill();
            });
            g.sparks.forEach((s) => this.drawSpark(s, g));
            if (g.state !== 'dying' && g.state !== 'over') this.drawPlayer(g);
        }

        g.particles.forEach((pt) => {
            ctx.globalAlpha = Math.max(0, pt.life / pt.max);
            ctx.fillStyle = pt.colour;
            ctx.fillRect(pt.x * CELL - 1.5, pt.y * CELL - 1.5, 3, 3);
        });
        ctx.globalAlpha = 1;
        g.texts.forEach((t) => {
            ctx.globalAlpha = Math.min(1, t.life);
            this.text(t.text, SF.clamp(t.x * CELL, 60, W - 60), t.y * CELL - (1.5 - t.life) * 20, 13, t.colour);
        });
        ctx.globalAlpha = 1;

        if (g.freezeT > 0) {
            ctx.fillStyle = 'rgba(165,243,252,0.08)';
            ctx.fillRect(0, 0, W, FIELD_H);
        }
        ctx.restore();

        this.drawOverlay(g);
    };

    Renderer.prototype.drawHud = function (g) {
        const ctx = this.ctx;
        ctx.fillStyle = '#0a0b1e';
        ctx.fillRect(0, 0, CW, HUD_H);
        ctx.fillStyle = '#26307a';
        ctx.fillRect(0, HUD_H - 2, CW, 2);
        const y = HUD_H / 2;
        this.text('SCORE ' + String(g.score).padStart(6, '0'), 10, y, 14, '#ffffff', 'left');
        this.text('HI ' + String(Math.max(g.hi, g.score)).padStart(6, '0'), 168, y, 14, '#8a93c9', 'left');
        this.text('SECTOR ' + g.level.number, 290, y, 14, '#c3a6ff', 'left');

        // Lives as little ships.
        ctx.fillStyle = '#7df9ff';
        for (let i = 0; i < Math.min(g.lives, 6); i++) {
            const lx = 392 + i * 13;
            ctx.beginPath();
            ctx.moveTo(lx, y - 6);
            ctx.lineTo(lx + 5, y + 5);
            ctx.lineTo(lx - 5, y + 5);
            ctx.fill();
        }

        // Claimed percentage bar with the target marked.
        const pct = g.field.percent();
        const bx = 486, bw = 110, by = y - 6;
        ctx.fillStyle = '#1b1f45';
        ctx.fillRect(bx, by, bw, 12);
        ctx.fillStyle = pct >= g.level.target ? '#80ff72' : '#4cc9f0';
        ctx.fillRect(bx, by, bw * Math.min(1, pct / 100), 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx + bw * (g.level.target / 100), by - 2, 2, 16);
        this.text(Math.floor(pct) + '%', 603, y, 13, '#ffffff', 'left');

        // Active power-ups, as a thin coloured timer under the HUD.
        let ix = 0;
        ['speed', 'freeze', 'shield', 'slow'].forEach((name) => {
            const t = g[name + 'T'];
            if (t > 0) {
                const spec = SF.POWERS[name];
                ctx.fillStyle = spec.colour;
                ctx.fillRect(ix, HUD_H - 4, (t / spec.duration) * 160, 2);
                ix += 160;
            }
        });
    };

    Renderer.prototype.drawPlayer = function (g) {
        const ctx = this.ctx, p = g.player;
        if (p.invulnT > 0 && Math.floor(g.time * 10) % 2) return;
        const cx = (p.x + 0.5) * CELL, cy = (p.y + 0.5) * CELL;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(p.fy, p.fx) + Math.PI / 2);
        ctx.fillStyle = p.drawing ? '#ffe066' : '#7df9ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, 5);
        ctx.lineTo(0, 2);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (g.shieldT > 0) {
            ctx.strokeStyle = 'rgba(255,209,102,' + (0.5 + Math.sin(g.time * 12) * 0.3).toFixed(2) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.stroke();
        }
    };

    Renderer.prototype.drawMinor = function (m, g) {
        const ctx = this.ctx;
        const x = m.x * CELL, y = m.y * CELL, r = m.r * CELL;
        ctx.save();
        ctx.translate(x, y);
        if (m.type === 'drifter') {
            ctx.rotate(m.spin);
            ctx.fillStyle = '#ff4fd8';
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.lineTo(r, 0);
            ctx.lineTo(0, r);
            ctx.lineTo(-r, 0);
            ctx.fill();
            ctx.fillStyle = '#ffd6f5';
            ctx.fillRect(-2, -2, 4, 4);
        } else if (m.type === 'zigzag') {
            ctx.fillStyle = '#7dff5a';
            ctx.fillRect(-r * 0.8, -r * 0.6, r * 1.6, r * 1.2);
            ctx.fillStyle = '#1b4332';
            const leg = Math.floor(g.time * 8) % 2 ? 2 : -2;
            ctx.fillRect(-r, r * 0.6, 3, 3 + leg);
            ctx.fillRect(r - 3, r * 0.6, 3, 3 - leg);
            ctx.fillRect(-r * 0.4, -r * 0.2, 3, 3);
            ctx.fillRect(r * 0.4 - 3, -r * 0.2, 3, 3);
        } else if (m.type === 'looper') {
            ctx.strokeStyle = '#ffa53a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.8, m.spin, m.spin + Math.PI * 1.6);
            ctx.stroke();
            ctx.fillStyle = '#ffe0b3';
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#ff3b3b';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            const a = Math.atan2(m.vy, m.vx);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 3, Math.sin(a) * 3, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    };

    Renderer.prototype.drawBoss = function (b, g) {
        const ctx = this.ctx;
        const x = b.x * CELL, y = b.y * CELL, r = b.r * CELL;
        if (b.type === 'orb') {
            const pulse = 1 + Math.sin(g.time * 4) * 0.05;
            const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r * pulse);
            grad.addColorStop(0, '#e0aaff');
            grad.addColorStop(0.6, '#9d4edd');
            grad.addColorStop(1, '#3c096c');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
            ctx.fill();
            const a = Math.atan2(g.player.y - b.y, g.player.x - b.x);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35, r * 0.3, r * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff006e';
            ctx.beginPath();
            ctx.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.12, 0, Math.PI * 2);
            ctx.fill();
        } else if (b.type === 'serpent') {
            for (let i = b.body.length - 1; i >= 0; i--) {
                const s = b.body[i];
                ctx.fillStyle = i % 2 ? '#2ec4b6' : '#06d6a0';
                ctx.beginPath();
                ctx.arc(s.x * CELL, s.y * CELL, s.r * CELL, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#118ab2';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            const a = Math.atan2(b.vy, b.vx);
            ctx.fillStyle = '#ffd166';
            [-0.6, 0.6].forEach((o) => {
                ctx.beginPath();
                ctx.arc(x + Math.cos(a + o) * r * 0.55, y + Math.sin(a + o) * r * 0.55, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        } else if (b.type === 'spinner') {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(b.spin);
            ctx.fillStyle = '#ef476f';
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
                const rr = i % 2 ? r * 0.6 : r * 1.1;
                const a = (i / 16) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = b.fireT < 0.5 ? '#ffffff' : '#ffd166';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            const a = Math.atan2(b.vy, b.vx);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a);
            ctx.fillStyle = g.player.drawing ? '#ff5400' : '#c1121f';
            ctx.beginPath();
            ctx.moveTo(r * 1.2, 0);
            ctx.lineTo(-r * 0.8, r * 0.9);
            ctx.lineTo(-r * 0.4, 0);
            ctx.lineTo(-r * 0.8, -r * 0.9);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fff3b0';
            ctx.beginPath();
            ctx.arc(r * 0.3, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    };

    Renderer.prototype.drawSpark = function (s, g) {
        const ctx = this.ctx;
        const x = (s.x + 0.5) * CELL, y = (s.y + 0.5) * CELL;
        const r = 4 + Math.sin(g.time * 20 + s.hand) * 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r);
        ctx.lineTo(x, y + r);
        ctx.stroke();
        ctx.fillStyle = '#ff006e';
        ctx.fillRect(x - 2, y - 2, 4, 4);
    };

    Renderer.prototype.drawBox = function (b, g) {
        const ctx = this.ctx;
        const x = (b.x + 0.5) * CELL, y = (b.y + 0.5) * CELL;
        const bob = Math.sin(g.time * 3 + b.x) * 1.5;
        ctx.fillStyle = '#3a0ca3';
        ctx.fillRect(x - 7, y - 7 + bob, 14, 14);
        ctx.strokeStyle = '#f72585';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 7, y - 7 + bob, 14, 14);
        this.text('?', x, y + 1 + bob, 12, '#ffffff');
    };

    Renderer.prototype.drawOverlay = function (g) {
        const ctx = this.ctx;
        const cx = CW / 2, cy = HUD_H + FIELD_H / 2;
        const shade = (a) => {
            ctx.fillStyle = 'rgba(0,0,10,' + a + ')';
            ctx.fillRect(0, HUD_H, CW, CH - HUD_H);
        };
        if (g.state === 'intro') {
            shade(0.45);
            this.text('SECTOR ' + g.level.number, cx, cy - 40, 30, '#c3a6ff');
            this.text(g.level.name.toUpperCase(), cx, cy, 22, '#ffffff');
            this.text('CLAIM ' + g.level.target + '% OF THE FIELD', cx, cy + 40, 16, '#7df9ff');
        } else if (g.state === 'paused') {
            shade(0.6);
            this.text('PAUSED', cx, cy - 10, 32, '#ffffff');
            this.text('Press P to carry on', cx, cy + 30, 15, '#8a93c9');
        } else if (g.state === 'clear') {
            this.text('SECTOR CLEARED', cx, cy - 20, 32, '#ffffff');
            this.text('BONUS ' + g.clearBonus, cx, cy + 22, 18, '#ffd166');
        } else if (g.state === 'over') {
            shade(0.65);
            this.text('GAME OVER', cx, cy - 50, 40, '#ff4d6d');
            this.text('SCORE ' + g.score, cx, cy, 20, '#ffffff');
            if (g.newHi) this.text('NEW HIGH SCORE!', cx, cy + 32, 18, '#ffd166');
            if (g.stateT > 1) this.text('Press Enter to play again', cx, cy + 70, 15, '#8a93c9');
        }
    };

    Renderer.prototype.drawTitle = function (g) {
        const ctx = this.ctx;
        ctx.drawImage(g.titlePicture, PAD, HUD_H / 2, W, FIELD_H);
        ctx.fillStyle = 'rgba(3,3,15,0.62)';
        ctx.fillRect(0, 0, CW, CH);
        const cx = CW / 2;
        const bob = Math.sin(g.time * 2) * 4;
        this.text('STARFENCE', cx, 110 + bob, 64, '#7df9ff');
        this.text('Fence off the field. Dodge everything that moves.', cx, 170, 15, '#ffffff');

        const lines = [
            ['Arrow keys / WASD', 'move along the edge'],
            ['Move into the field', 'draw a line'],
            ['Join back up', 'claim the side without the boss'],
            ['Enemies touch you or your line', 'lose a life'],
            ['Claim the target %', 'clear the sector'],
            ['Trap a ? box', 'power-up'],
        ];
        lines.forEach((l, i) => {
            this.text(l[0], cx - 12, 225 + i * 26, 14, '#ffd166', 'right');
            this.text(l[1], cx + 12, 225 + i * 26, 14, '#c9d1ff', 'left');
        });

        if (Math.floor(g.time * 2) % 2 === 0) this.text('PRESS ENTER TO START', cx, 420, 20, '#ffffff');
        this.text('HI ' + String(g.hi).padStart(6, '0') + '    P pause    M sound ' + (SF.sound.muted ? 'off' : 'on'), cx, 470, 13, '#8a93c9');
    };

    SF.Renderer = Renderer;
})(window.SF);
