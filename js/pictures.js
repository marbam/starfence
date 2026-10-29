(function (SF) {
    'use strict';

    // Hidden pictures revealed as you claim the field. Each painter draws a full
    // 640x480 scene with canvas calls, so there are no image files.

    function linear(ctx, y0, y1, stops) {
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
        return g;
    }

    function stars(ctx, w, h, rng, count, maxY) {
        for (let i = 0; i < count; i++) {
            const s = rng() < 0.9 ? 1 : 2;
            ctx.fillStyle = 'rgba(255,255,255,' + rng.range(0.3, 1).toFixed(2) + ')';
            ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * (maxY || h)), s, s);
        }
    }

    function ridge(ctx, w, base, amp, step, rng, colour, bottom) {
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(0, bottom);
        let y = base - rng() * amp;
        for (let x = 0; x <= w + step; x += step) {
            y = SF.clamp(y + rng.range(-amp, amp) * 0.6, base - amp, base);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w, bottom);
        ctx.closePath();
        ctx.fill();
    }

    const painters = {
        sunset(ctx, w, h, rng) {
            const horizon = h * 0.62;
            ctx.fillStyle = linear(ctx, 0, horizon, ['#160a3a', '#7b1f6a', '#ff5e62', '#ffb347']);
            ctx.fillRect(0, 0, w, horizon);
            stars(ctx, w, h, rng, 80, horizon * 0.4);

            // Striped retro sun, drawn on its own canvas so the stripes cut cleanly.
            const sun = SF.makeCanvas(240, 240);
            const s = sun.getContext('2d');
            s.fillStyle = linear(s, 0, 240, ['#fff176', '#ffb300', '#ff4081']);
            s.beginPath();
            s.arc(120, 120, 110, 0, Math.PI * 2);
            s.fill();
            s.globalCompositeOperation = 'destination-out';
            for (let i = 0; i < 7; i++) s.fillRect(0, 130 + i * 15, 240, 3 + i * 1.2);
            ctx.drawImage(sun, w / 2 - 120, horizon - 190);

            ridge(ctx, w, horizon - 40, 70, 40, rng, '#4a1a66', horizon);
            ridge(ctx, w, horizon - 10, 50, 28, rng, '#2a0f45', horizon);
            ridge(ctx, w, horizon, 25, 18, rng, '#16082a', horizon + 1);

            ctx.fillStyle = linear(ctx, horizon, h, ['#3b1660', '#12052a']);
            ctx.fillRect(0, horizon, w, h - horizon);
            for (let i = 0; i < 26; i++) {
                const y = horizon + 6 + i * i * 0.35;
                const half = 110 - i * 3.5 + rng.range(-10, 10);
                ctx.fillStyle = 'rgba(255,170,90,' + (0.7 - i * 0.025).toFixed(2) + ')';
                ctx.fillRect(w / 2 - half, y, half * 2, 2);
            }
        },

        nebula(ctx, w, h, rng) {
            ctx.fillStyle = '#02010a';
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 9; i++) {
                const x = rng() * w, y = rng() * h, r = rng.range(120, 260);
                const hue = rng.pick([280, 200, 320, 180, 240]);
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                g.addColorStop(0, 'hsla(' + hue + ',90%,60%,0.45)');
                g.addColorStop(1, 'hsla(' + hue + ',90%,40%,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            }
            ctx.globalCompositeOperation = 'source-over';
            stars(ctx, w, h, rng, 500);

            // Ringed planet.
            const px = w * 0.7, py = h * 0.62, pr = 70;
            ctx.strokeStyle = 'rgba(255,220,180,0.55)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.ellipse(px, py, pr * 1.9, pr * 0.45, -0.3, Math.PI, Math.PI * 2);
            ctx.stroke();
            const pg = ctx.createRadialGradient(px - 25, py - 25, 10, px, py, pr);
            pg.addColorStop(0, '#ffd59e');
            pg.addColorStop(1, '#a0522d');
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(px, py, pr * 1.9, pr * 0.45, -0.3, 0, Math.PI);
            ctx.stroke();
        },

        ocean(ctx, w, h, rng) {
            ctx.fillStyle = linear(ctx, 0, h, ['#4fd1ff', '#0077b6', '#023e8a', '#03045e']);
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 6; i++) {
                const x = rng() * w;
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.beginPath();
                ctx.moveTo(x - 20, 0);
                ctx.lineTo(x + 30, 0);
                ctx.lineTo(x + 140, h);
                ctx.lineTo(x + 40, h);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';

            ctx.fillStyle = '#d8b878';
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h - 40 - Math.sin(x / 60) * 12);
            ctx.lineTo(w, h);
            ctx.fill();

            for (let i = 0; i < 16; i++) {
                const x = rng() * w, tall = rng.range(80, 200);
                ctx.strokeStyle = rng.pick(['#2d6a4f', '#40916c', '#52b788']);
                ctx.lineWidth = rng.range(5, 9);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x, h - 30);
                ctx.bezierCurveTo(x - 30, h - tall * 0.4, x + 30, h - tall * 0.7, x - 5, h - tall);
                ctx.stroke();
            }

            for (let i = 0; i < 12; i++) {
                const x = rng.range(40, w - 40), y = rng.range(40, h - 120);
                const size = rng.range(12, 24), dir = rng() < 0.5 ? -1 : 1;
                ctx.fillStyle = rng.pick(['#ff9f1c', '#ffbf69', '#f72585', '#fee440', '#80ffdb']);
                ctx.beginPath();
                ctx.ellipse(x, y, size, size * 0.55, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x - dir * size * 0.8, y);
                ctx.lineTo(x - dir * size * 1.6, y - size * 0.6);
                ctx.lineTo(x - dir * size * 1.6, y + size * 0.6);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(x + dir * size * 0.5, y - size * 0.15, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 40; i++) {
                ctx.beginPath();
                ctx.arc(rng() * w, rng() * h * 0.8, rng.range(2, 7), 0, Math.PI * 2);
                ctx.stroke();
            }
        },

        city(ctx, w, h, rng) {
            const ground = h * 0.74;
            ctx.fillStyle = linear(ctx, 0, ground, ['#0f0c29', '#302b63', '#7a3e8f']);
            ctx.fillRect(0, 0, w, ground);
            stars(ctx, w, h, rng, 120, ground * 0.6);
            ctx.fillStyle = '#fff6d5';
            ctx.beginPath();
            ctx.arc(w * 0.18, h * 0.18, 34, 0, Math.PI * 2);
            ctx.fill();

            const windowsOn = ['#ffe066', '#ffd166', '#7df9ff', '#ff8fab'];
            [['#221b45', 140, 0.5], ['#140f2e', 240, 0.35]].forEach(([colour, maxH, lit]) => {
                let x = -10;
                while (x < w) {
                    const bw = rng.range(36, 72), bh = rng.range(70, maxH);
                    ctx.fillStyle = colour;
                    ctx.fillRect(x, ground - bh, bw, bh);
                    for (let wy = ground - bh + 8; wy < ground - 6; wy += 10) {
                        for (let wx = x + 5; wx < x + bw - 6; wx += 8) {
                            if (rng() < lit) {
                                ctx.fillStyle = rng.pick(windowsOn);
                                ctx.fillRect(wx, wy, 4, 5);
                            }
                        }
                    }
                    x += bw + rng.range(2, 10);
                }
            });

            // Neon signs.
            ctx.shadowBlur = 14;
            for (let i = 0; i < 5; i++) {
                const c = rng.pick(['#ff2e97', '#00f0ff', '#b8ff3c']);
                ctx.shadowColor = c;
                ctx.fillStyle = c;
                ctx.fillRect(rng.range(20, w - 60), rng.range(ground - 160, ground - 40), rng.range(24, 50), 5);
            }
            ctx.shadowBlur = 0;

            ctx.fillStyle = linear(ctx, ground, h, ['#1b1640', '#05040f']);
            ctx.fillRect(0, ground, w, h - ground);
            for (let i = 0; i < 90; i++) {
                ctx.fillStyle = rng.pick(windowsOn);
                ctx.globalAlpha = rng.range(0.15, 0.5);
                ctx.fillRect(rng() * w, ground + rng() * (h - ground), rng.range(10, 40), 2);
            }
            ctx.globalAlpha = 1;
        },

        aurora(ctx, w, h, rng) {
            ctx.fillStyle = linear(ctx, 0, h, ['#020617', '#0b1d3a', '#1e3a5f']);
            ctx.fillRect(0, 0, w, h);
            stars(ctx, w, h, rng, 260, h * 0.7);
            ctx.globalCompositeOperation = 'lighter';
            [['#3dffa2', 120, 0.012], ['#22d3ee', 160, 0.018], ['#c084fc', 90, 0.009]].forEach(([c, base, f]) => {
                const ph = rng() * 10;
                for (let x = 0; x < w; x += 2) {
                    const y = base + Math.sin(x * f + ph) * 40 + Math.sin(x * f * 3.1) * 12;
                    const g = ctx.createLinearGradient(0, y, 0, y + 130);
                    g.addColorStop(0, c);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.globalAlpha = 0.16;
                    ctx.fillRect(x, y, 2, 130);
                }
            });
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';

            [[h * 0.72, '#cfe3f5'], [h * 0.8, '#a9c6e3'], [h * 0.9, '#e8f3ff']].forEach(([y0, c], i) => {
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.moveTo(0, h);
                for (let x = 0; x <= w; x += 10) ctx.lineTo(x, y0 + Math.sin(x / (90 + i * 30) + i) * 22);
                ctx.lineTo(w, h);
                ctx.fill();
            });
            for (let i = 0; i < 22; i++) {
                const x = rng() * w, y = h * rng.range(0.74, 0.95), s = rng.range(14, 30);
                ctx.fillStyle = '#0d2b2b';
                for (let k = 0; k < 3; k++) {
                    ctx.beginPath();
                    ctx.moveTo(x, y - s * 2.2 + k * s * 0.6);
                    ctx.lineTo(x - s * (0.5 + k * 0.2), y - s * 0.9 + k * s * 0.6);
                    ctx.lineTo(x + s * (0.5 + k * 0.2), y - s * 0.9 + k * s * 0.6);
                    ctx.fill();
                }
            }
        },

        mandala(ctx, w, h, rng) {
            const cx = w / 2, cy = h / 2;
            const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420);
            bg.addColorStop(0, '#3a0ca3');
            bg.addColorStop(1, '#10002b');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            const base = rng() * 360;
            for (let k = 9; k >= 1; k--) {
                const n = 6 + k * 2, rad = k * 30;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2 + (k % 2) * (Math.PI / n);
                    ctx.save();
                    ctx.translate(cx + Math.cos(a) * rad * 0.6, cy + Math.sin(a) * rad * 0.6);
                    ctx.rotate(a);
                    ctx.fillStyle = 'hsl(' + ((base + k * 38) % 360) + ',85%,' + (45 + (k % 3) * 10) + '%)';
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, rad * 0.45, Math.max(6, rad * 0.14), 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                }
            }
            ctx.fillStyle = '#ffd60a';
            ctx.beginPath();
            ctx.arc(cx, cy, 16, 0, Math.PI * 2);
            ctx.fill();
            for (let i = 0; i < 160; i++) {
                ctx.fillStyle = 'hsla(' + ((base + i * 7) % 360) + ',90%,70%,0.8)';
                ctx.beginPath();
                ctx.arc(rng() * w, rng() * h, rng.range(1, 3), 0, Math.PI * 2);
                ctx.fill();
            }
        },

        dunes(ctx, w, h, rng) {
            ctx.fillStyle = linear(ctx, 0, h * 0.6, ['#ffb88c', '#ffd8a8', '#fff1d6']);
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#fff3b0';
            ctx.beginPath();
            ctx.arc(w * 0.78, h * 0.2, 46, 0, Math.PI * 2);
            ctx.fill();

            // Pyramids, lit from the right.
            [[w * 0.3, 120], [w * 0.47, 80], [w * 0.15, 60]].forEach(([x, s]) => {
                const base = h * 0.6;
                ctx.fillStyle = '#d9a25f';
                ctx.beginPath();
                ctx.moveTo(x, base - s);
                ctx.lineTo(x - s, base);
                ctx.lineTo(x, base);
                ctx.fill();
                ctx.fillStyle = '#f2c27b';
                ctx.beginPath();
                ctx.moveTo(x, base - s);
                ctx.lineTo(x + s, base);
                ctx.lineTo(x, base);
                ctx.fill();
            });

            ['#f4c27f', '#e9a85c', '#d98e45', '#c47530'].forEach((c, i) => {
                const y0 = h * (0.58 + i * 0.1);
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.moveTo(0, h);
                const ph = rng() * 6;
                for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin(x / (70 + i * 25) + ph) * (14 + i * 4));
                ctx.lineTo(w, h);
                ctx.fill();
            });

            ctx.strokeStyle = '#5b3a29';
            ctx.lineWidth = 2;
            for (let i = 0; i < 7; i++) {
                const x = rng.range(60, w - 60), y = rng.range(40, 140), s = rng.range(6, 12);
                ctx.beginPath();
                ctx.moveTo(x - s, y);
                ctx.quadraticCurveTo(x - s / 2, y - s / 2, x, y);
                ctx.quadraticCurveTo(x + s / 2, y - s / 2, x + s, y);
                ctx.stroke();
            }
        },

        forest(ctx, w, h, rng) {
            ctx.fillStyle = linear(ctx, 0, h, ['#0b132b', '#1c2541', '#3a506b']);
            ctx.fillRect(0, 0, w, h);
            stars(ctx, w, h, rng, 160, h * 0.5);
            const mx = w * 0.62, my = h * 0.3;
            const glow = ctx.createRadialGradient(mx, my, 50, mx, my, 160);
            glow.addColorStop(0, 'rgba(255,255,220,0.35)');
            glow.addColorStop(1, 'rgba(255,255,220,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#f8f4e3';
            ctx.beginPath();
            ctx.arc(mx, my, 62, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(180,170,150,0.4)';
            for (let i = 0; i < 7; i++) {
                ctx.beginPath();
                ctx.arc(mx + rng.range(-40, 40), my + rng.range(-40, 40), rng.range(5, 12), 0, Math.PI * 2);
                ctx.fill();
            }

            ['#25475a', '#1a3542', '#10242c', '#061214'].forEach((c, layer) => {
                ctx.fillStyle = c;
                const base = h * (0.62 + layer * 0.11);
                ctx.fillRect(0, base, w, h - base);
                let x = -20;
                while (x < w + 20) {
                    const s = rng.range(18, 34) + layer * 6;
                    ctx.beginPath();
                    ctx.moveTo(x, base - s * 3);
                    ctx.lineTo(x - s, base + 2);
                    ctx.lineTo(x + s, base + 2);
                    ctx.fill();
                    x += s * rng.range(0.9, 1.6);
                }
            });

            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 45; i++) {
                const x = rng() * w, y = rng.range(h * 0.55, h);
                const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
                g.addColorStop(0, 'rgba(230,255,120,0.9)');
                g.addColorStop(1, 'rgba(230,255,120,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x - 8, y - 8, 16, 16);
            }
            ctx.globalCompositeOperation = 'source-over';
        },
    };

    SF.paintPicture = function (name, seed) {
        const c = SF.makeCanvas(SF.W, SF.FIELD_H);
        const ctx = c.getContext('2d');
        painters[name](ctx, c.width, c.height, SF.makeRng(seed));
        return c;
    };

    SF.PICTURE_NAMES = Object.keys(painters);
})(window.SF);
