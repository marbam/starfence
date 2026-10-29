(function (SF) {
    'use strict';

    // One entry per sector. After the last one the list repeats, faster and with a higher target.
    //   target  - percentage of the field to claim
    //   boss    - orb | serpent | spinner | hunter (see entities.js)
    //   minors  - small enemies inside the field
    //   sparks  - patrol enemies that run along the edge
    //   boxes   - mystery power-up boxes
    SF.LEVELS = [
        { name: 'Dusk Coast', picture: 'sunset', target: 75, boss: 'orb', minors: ['drifter', 'drifter'], sparks: 0, boxes: 3 },
        { name: 'Violet Drift', picture: 'nebula', target: 75, boss: 'serpent', minors: ['drifter', 'zigzag'], sparks: 1, boxes: 3 },
        { name: 'Deep Reef', picture: 'ocean', target: 78, boss: 'spinner', minors: ['drifter', 'looper', 'seeker'], sparks: 1, boxes: 3 },
        { name: 'Neon Harbour', picture: 'city', target: 78, boss: 'hunter', minors: ['zigzag', 'zigzag', 'drifter'], sparks: 2, boxes: 3 },
        { name: 'Polar Night', picture: 'aurora', target: 80, boss: 'orb', minors: ['drifter', 'drifter', 'looper', 'seeker'], sparks: 2, boxes: 4 },
        { name: 'Prism Gate', picture: 'mandala', target: 80, boss: 'serpent', minors: ['zigzag', 'looper', 'looper', 'seeker'], sparks: 2, boxes: 4 },
        { name: 'Amber Sands', picture: 'dunes', target: 82, boss: 'spinner', minors: ['drifter', 'zigzag', 'seeker', 'seeker'], sparks: 3, boxes: 4 },
        { name: 'Moonwood', picture: 'forest', target: 85, boss: 'hunter', minors: ['drifter', 'zigzag', 'looper', 'seeker', 'seeker'], sparks: 3, boxes: 4 },
    ];

    SF.levelFor = function (index) {
        const n = SF.LEVELS.length;
        const base = SF.LEVELS[index % n];
        const loop = Math.floor(index / n);
        return Object.assign({}, base, {
            number: index + 1,
            loop: loop,
            speed: 1 + 0.07 * (index % n) + 0.2 * loop,
            target: Math.min(90, base.target + loop * 2),
        });
    };
})(window.SF);
