(function (SF) {
    'use strict';

    const UNCLAIMED = SF.UNCLAIMED, CLAIMED = SF.CLAIMED, TRAIL = SF.TRAIL;

    // The playfield grid. A cell is UNCLAIMED, CLAIMED or TRAIL (the line being drawn).
    // "Edge" cells are claimed cells next to unclaimed space: the ship and sparks travel on these.
    function Field(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.cells = new Uint8Array(cols * rows);
        this.edge = new Uint8Array(cols * rows);
        this.reset();
    }

    Field.prototype.reset = function () {
        const cols = this.cols, rows = this.rows, cells = this.cells;
        cells.fill(UNCLAIMED);
        for (let x = 0; x < cols; x++) {
            cells[x] = CLAIMED;
            cells[(rows - 1) * cols + x] = CLAIMED;
        }
        for (let y = 0; y < rows; y++) {
            cells[y * cols] = CLAIMED;
            cells[y * cols + cols - 1] = CLAIMED;
        }
        this.interiorTotal = (cols - 2) * (rows - 2);
        this.claimedInterior = 0;
        this.computeEdges();
    };

    Field.prototype.inBounds = function (x, y) {
        return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
    };

    Field.prototype.get = function (x, y) {
        return this.inBounds(x, y) ? this.cells[y * this.cols + x] : CLAIMED;
    };

    Field.prototype.isEdge = function (x, y) {
        return this.inBounds(x, y) && this.edge[y * this.cols + x] === 1;
    };

    Field.prototype.computeEdges = function () {
        const cols = this.cols, rows = this.rows, cells = this.cells, edge = this.edge;
        edge.fill(0);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (cells[y * cols + x] !== CLAIMED) continue;
                let found = false;
                for (let dy = -1; dy <= 1 && !found; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                        if (cells[ny * cols + nx] !== CLAIMED) {
                            found = true;
                            break;
                        }
                    }
                }
                if (found) edge[y * cols + x] = 1;
            }
        }
    };

    Field.prototype.percent = function () {
        return (this.claimedInterior / this.interiorTotal) * 100;
    };

    // Searches outward in square rings from (x, y) for the nearest cell matching test(index).
    Field.prototype.nearest = function (x, y, test) {
        const cx = Math.floor(x), cy = Math.floor(y);
        const maxR = Math.max(this.cols, this.rows);
        const check = (px, py) => this.inBounds(px, py) && test(py * this.cols + px);
        for (let r = 0; r <= maxR; r++) {
            for (let d = -r; d <= r; d++) {
                if (check(cx + d, cy - r)) return (cy - r) * this.cols + cx + d;
                if (check(cx + d, cy + r)) return (cy + r) * this.cols + cx + d;
                if (check(cx - r, cy + d)) return (cy + d) * this.cols + cx - r;
                if (check(cx + r, cy + d)) return (cy + d) * this.cols + cx + r;
            }
        }
        return -1;
    };

    Field.prototype.nearestEdge = function (x, y) {
        return this.nearest(x, y, (i) => this.edge[i] === 1);
    };

    // Finishes a line. The trail becomes claimed, then every unclaimed pocket is
    // claimed except the one holding the boss (at keepX, keepY).
    Field.prototype.close = function (trail, keepX, keepY) {
        const cols = this.cols, rows = this.rows, cells = this.cells;
        for (const i of trail) cells[i] = CLAIMED;

        // Label the unclaimed pockets.
        const comp = new Int32Array(cols * rows).fill(-1);
        const queue = new Int32Array(cols * rows);
        let label = 0;
        for (let start = 0; start < cells.length; start++) {
            if (cells[start] !== UNCLAIMED || comp[start] !== -1) continue;
            let head = 0, tail = 0;
            queue[tail++] = start;
            comp[start] = label;
            while (head < tail) {
                const i = queue[head++];
                const x = i % cols, y = (i / cols) | 0;
                if (x > 0 && cells[i - 1] === UNCLAIMED && comp[i - 1] === -1) { comp[i - 1] = label; queue[tail++] = i - 1; }
                if (x < cols - 1 && cells[i + 1] === UNCLAIMED && comp[i + 1] === -1) { comp[i + 1] = label; queue[tail++] = i + 1; }
                if (y > 0 && cells[i - cols] === UNCLAIMED && comp[i - cols] === -1) { comp[i - cols] = label; queue[tail++] = i - cols; }
                if (y < rows - 1 && cells[i + cols] === UNCLAIMED && comp[i + cols] === -1) { comp[i + cols] = label; queue[tail++] = i + cols; }
            }
            label++;
        }

        const seed = this.nearest(keepX, keepY, (i) => cells[i] === UNCLAIMED);
        const keep = seed === -1 ? -1 : comp[seed];
        let captured = 0;
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] === UNCLAIMED && comp[i] !== keep) {
                cells[i] = CLAIMED;
                captured++;
            }
        }

        this.claimedInterior += captured + trail.length;
        this.computeEdges();
        return { captured: captured, trail: trail.length };
    };

    Field.prototype.revertTrail = function (trail) {
        for (const i of trail) this.cells[i] = UNCLAIMED;
    };

    // Counts cells holding `value` that overlap a circle (in cell units).
    // Anything outside the field counts as claimed.
    Field.prototype.scan = function (x, y, r, value) {
        let n = 0;
        const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
        const y0 = Math.floor(y - r), y1 = Math.floor(y + r);
        const r2 = r * r;
        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) {
                const v = this.inBounds(cx, cy) ? this.cells[cy * this.cols + cx] : CLAIMED;
                if (v !== value) continue;
                const nx = x < cx ? cx : x > cx + 1 ? cx + 1 : x;
                const ny = y < cy ? cy : y > cy + 1 ? cy + 1 : y;
                const dx = x - nx, dy = y - ny;
                if (dx * dx + dy * dy < r2) n++;
            }
        }
        return n;
    };

    SF.Field = Field;
})(window.SF);
