window.SF = window.SF || {};

(function (SF) {
    'use strict';

    // Field size in cells. Each cell is CELL pixels; the HUD bar sits above the field.
    SF.COLS = 160;
    SF.ROWS = 120;
    SF.CELL = 4;
    SF.HUD_H = 32;
    SF.W = SF.COLS * SF.CELL;
    SF.FIELD_H = SF.ROWS * SF.CELL;
    SF.H = SF.FIELD_H + SF.HUD_H;
    SF.PAD = 8; // margin round the field so sprites on the border are not cut off
    SF.CW = SF.W + SF.PAD * 2;
    SF.CH = SF.H + SF.PAD;

    // Cell values.
    SF.UNCLAIMED = 0;
    SF.CLAIMED = 1;
    SF.TRAIL = 2;

    // Seeded random numbers (mulberry32), so ?seed=123 in the URL gives a repeatable game.
    SF.makeRng = function (seed) {
        let a = seed >>> 0;
        const next = function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        next.range = (lo, hi) => lo + next() * (hi - lo);
        next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
        next.pick = (arr) => arr[Math.floor(next() * arr.length)];
        return next;
    };

    // localStorage that can never break the game (private windows, blocked storage).
    SF.store = {
        get(key, fallback) {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : v;
            } catch (e) {
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, String(value));
            } catch (e) { /* ignore */ }
        },
    };

    SF.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    SF.makeCanvas = function (w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    };
})(window.SF);
