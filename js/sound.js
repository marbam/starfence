(function (SF) {
    'use strict';

    // Retro sound effects generated with Web Audio, so there are no audio files.
    let ctx = null;
    let master = null;
    let muted = SF.store.get('sf.sound', 'on') === 'off';

    function ensure() {
        if (ctx) {
            if (ctx.state === 'suspended') ctx.resume();
            return ctx;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.22;
        master.connect(ctx.destination);
        return ctx;
    }

    function tone(freq, dur, opts) {
        opts = opts || {};
        if (muted) return;
        const c = ensure();
        if (!c) return;
        const t = c.currentTime + (opts.delay || 0);
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = opts.type || 'square';
        o.frequency.setValueAtTime(freq, t);
        if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
        g.gain.setValueAtTime(opts.vol || 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    function noise(dur, opts) {
        opts = opts || {};
        if (muted) return;
        const c = ensure();
        if (!c) return;
        const t = c.currentTime + (opts.delay || 0);
        const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource();
        src.buffer = buf;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(opts.from || 3000, t);
        filter.frequency.exponentialRampToValueAtTime(opts.to || 100, t + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(opts.vol || 0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start(t);
    }

    SF.sound = {
        unlock: ensure,
        get muted() {
            return muted;
        },
        toggle() {
            muted = !muted;
            SF.store.set('sf.sound', muted ? 'off' : 'on');
        },
        tick() {
            tone(880, 0.025, { vol: 0.05 });
        },
        claim(cells) {
            // Bigger claims play a longer rising run of notes.
            const notes = Math.min(8, 2 + Math.floor(cells / 400));
            for (let i = 0; i < notes; i++) {
                tone(330 * Math.pow(1.19, i), 0.09, { delay: i * 0.05, vol: 0.18, type: 'triangle' });
            }
        },
        kill() {
            tone(600, 0.2, { to: 80, vol: 0.2 });
            noise(0.2, { vol: 0.25, from: 4000, to: 300 });
        },
        die() {
            noise(0.9, { vol: 0.6, from: 5000, to: 60 });
            tone(440, 0.8, { to: 40, type: 'sawtooth', vol: 0.2 });
        },
        power() {
            [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, { delay: i * 0.06, vol: 0.2, type: 'triangle' }));
        },
        life() {
            [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.15, { delay: i * 0.08, vol: 0.22 }));
        },
        shoot() {
            tone(1200, 0.12, { to: 300, vol: 0.08, type: 'sawtooth' });
        },
        clear() {
            [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) =>
                tone(f, 0.18, { delay: i * 0.12, vol: 0.22, type: i % 2 ? 'square' : 'triangle' }));
        },
        start() {
            [262, 392, 523].forEach((f, i) => tone(f, 0.12, { delay: i * 0.08, vol: 0.2 }));
        },
        gameOver() {
            [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { delay: i * 0.25, vol: 0.2, type: 'triangle' }));
        },
    };
})(window.SF);
