// diegofg.com

// if sand can be also spawn with mouse
const SAND_WITH_MOUSE = false;


const $ = q => document.querySelector(q);
const $$ = q => document.querySelectorAll(q);
const $c = el => document.createElement(el);

const W = 355;
const H = 200;
let window_ratio = 1;
let canvas, ctx;
let cursor = { x: 0, y: 0, col: 0, line: 0, caret: true };
let lines;

// editor stuff
const CHARS = ' abcdefghijklmnopqrstuvwxyz0123456789!,.-_=?+`":;@#$%&*()<>';
const MARGIN = 5;
const LINE_HEIGHT = 10;
const CHARW = 6;
const CHARH = 8;
const MAX_LINES = 10;
const MAX_COLS = Math.floor((W - MARGIN * 2) / CHARW);


// sim stuff
let imdata, fb, fbctx;
let world, prev_world;
const AIR = 0;
const WATER = 1;
const SAND = 2;
const STONE = 3;
const EARTH = 4;
const GRASS = 5;
const PALETTE = [
    ['#150f18'],
    ['#58f', '#5c8dff'],
    ['#ca5', '#b94', '#c95'],
    ['#444', '#555'],
    ['#852', '#741', '#963'],
    ['#474', '#407040'],
]
let painting = false;

function init() {
    canvas = $('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';

    document.addEventListener('keydown', on_key_down);
    canvas.addEventListener('mousedown', on_mouse);
    document.addEventListener('mouseup', on_mouse);
    document.addEventListener('mousemove', on_mouse);
    window.addEventListener('resize', onresize);
    onresize();
    setInterval(() => {
        cursor.caret = !cursor.caret;
    }, 500);
    new_file();

    fb = new OffscreenCanvas(W, H);
    fbctx = fb.getContext('2d', { antialias: false, alpha: false });

    requestAnimationFrame(draw);
}

document.onload = init();


function new_file() {
    lines = new Array(MAX_LINES);
    for (let i = 0; i < lines.length; i++) {
        lines[i] = new Array(MAX_COLS);
        lines[i].fill('');
    }

    world = new Array(H);
    for (let i = 0; i < H; i++) {
        world[i] = new Array(W);
        world[i].fill(AIR);
    }

    prev_world = new Array(H);
    for (let i = 0; i < H; i++) {
        prev_world[i] = new Array(W);
        prev_world[i].fill(99);
    }
}

function onresize() {
    const info = canvas.getBoundingClientRect();
    window_ratio = W / info.width;
}

function coords2xy(line, col) {
    return [
        Math.floor(MARGIN + col * CHARW),
        Math.floor(MARGIN + line * LINE_HEIGHT)
    ];
}

function xy2coords(x, y) {
    return [
        Math.max(0, Math.min(MAX_LINES, Math.floor((y - MARGIN) / LINE_HEIGHT))),
        Math.max(0, Math.min(MAX_COLS, Math.floor((x - MARGIN) / CHARW))),
    ];
}

function draw() {
    requestAnimationFrame(draw);
    // update cursor
    [cursor.x, cursor.y] = coords2xy(cursor.line, cursor.col);

    // sandy sand sand
    simulate();

    draw_editor()

    // draw caret
    ctx.fillStyle = PALETTE[SAND][0];
    if (cursor.caret) {
        ctx.fillRect(cursor.x, cursor.y, 2, CHARH);
    }

}

/// EDITOR STUFF

let KEYWORDS = [];
KEYWORDS[SAND] = 'sand,beach'.split(',');
KEYWORDS[WATER] = 'water,river,sea,ocean,h2o,flow,liquid'.split(',');
// KEYWORDS[STONE] = ''.split(','); // stone doesn't fall, not good for editor
KEYWORDS[EARTH] = 'earth,soil,dirt,floor'.split(',');
KEYWORDS[GRASS] = 'grass,green,field,country'.split(',');

function draw_editor() {
    let brush = SAND;
    for (let line in lines) {
        for (let col in lines[line]) {
            brush = update_editor_brush_from_keywords(brush, lines[line].join('').substr(col));
            draw_char(coords2xy(line, col), lines[line][col], brush);
        }
    }
}

function update_editor_brush_from_keywords(curr_brush, line) {
    for (let i in KEYWORDS) {
        for (let j in KEYWORDS[i]) {
            const keyword = KEYWORDS[i][j];
            if (line.length < keyword.length) continue;
            if (line.substring(0, keyword.length) == keyword) {
                return i;
            }
        }
    }
    return curr_brush;
}

function draw_char(coords, ch, brush) {
    const glyph = FONT[ch] || '0000000000111100001001000010010000100100001001000011110000000000';
    if (ch == '' || ch == ' ') return;
    for (let y = 0, i = 0; y < CHARH; y++) {
        for (let x = 0; x < CHARW; x++, i++) {
            ctx.fillStyle = glyph[i] == '1' ? PALETTE[brush][0] : PALETTE[AIR];
            ctx.fillRect(coords[0] + x, coords[1] + y, 1, 1);
        }
    }

    // ctx.fillText(ch, coords[0], coords[1]);
}

function on_mouse(ev) {
    painting = ev.buttons == 1;
    if (painting) {
        const mx = Math.floor(ev.offsetX * window_ratio);
        const my = Math.floor(ev.offsetY * window_ratio);
        [cursor.line, cursor.col] = xy2coords(mx, my);
        cursor.caret = true;

        if (SAND_WITH_MOUSE) {
            paint(mx, my + CHARH, 2, SAND);
        }
    }
}


function mouse_up(ev) {
    painting = false;
}
function mouse_move(ev) {
    if (!painting) return;
    mousex = Math.floor(ev.offsetX / SCALE);
    mousey = Math.floor(ev.offsetY / SCALE);
}


function on_key_down(ev) {
    if (ev.key == 'ArrowRight') {
        if (cursor.col == last_col_in_line(cursor.line)) {
            if (cursor.line < MAX_LINES - 1) {
                cursor.col = 0;
                cursor.line++;
            }
        } else {
            cursor.col++;
        }
    }
    else if (ev.key == 'ArrowLeft') {
        if (cursor.col > 0) cursor.col--;
        else if (cursor.line > 0) {
            cursor.line--;
            cursor.col = last_col_in_line(cursor.line);
        }
    }
    else if (ev.key == 'Backspace') {
        if (cursor.col > 0) {
            cursor.col--;
            lines[cursor.line].splice(cursor.col, 1);
            lines[cursor.line].push('');
        } else if (cursor.line > 0) {
            cursor.line--;
            // find last char
            cursor.col = last_col_in_line(cursor.line);
        }
    }
    else if (ev.key == 'Delete') {
        lines[cursor.line].splice(cursor.col, 1);
        lines[cursor.line].push('');
    }
    else if (ev.key == 'Enter') {
        add_enter();
    }
    else if (CHARS.indexOf(ev.key.toLowerCase()) !== -1) { // valid printable char
        let ok = true;
        if (cursor.x >= W - CHARW) {
            ok = add_enter();
        }
        if (ok) {
            lines[cursor.line][cursor.col] = ev.key.toLowerCase();
            cursor.col++;
        }

    }
    cursor.caret = true;
}

function last_col_in_line(line) {
    let col = MAX_COLS - 1;
    while (col > 0) {
        if (lines[line][col] != '') { break; }
        col--;
    }
    return col + 1;
}

function add_enter() {
    if (cursor.line < MAX_LINES - 1) {
        cursor.line++;
        cursor.col = 0;
        return true;
    }
    return false;
}


/// SIM STUFF


function update_sand(x, y) {
    if (world[y][x] == SAND && (world[y + 1][x] == AIR || world[y + 1][x] == WATER)) {
        world[y][x] = world[y + 1][x];
        world[y + 1][x] = SAND;
    }

    if (world[y + 1][x + 1] == AIR && world[y][x] == SAND) {
        world[y + 1][x + 1] = SAND;
        world[y][x] = AIR;
    }
    if (world[y + 1][x - 1] == AIR && world[y][x] == SAND) {
        world[y + 1][x - 1] = SAND;
        world[y][x] = AIR;
    }

}

function update_wood(x, y) {
    if (world[y][x] == EARTH && (world[y + 1][x] == AIR || world[y + 1][x] == WATER)) {
        world[y][x] = world[y + 1][x];
        world[y + 1][x] = EARTH;
    }
}

function update_plant(x, y) {
    if (world[y][x] == GRASS && (world[y + 1][x] == AIR || world[y + 1][x] == WATER || world[y + 1][x] == STONE)) {
        world[y][x] = world[y + 1][x];
    }

    if (Math.random() < 0.01) {
        if (world[y][x] == GRASS && world[y - 1][x] == AIR && y < H - 4 && world[y + 3][x] != GRASS) {
            world[y - 1][x] = GRASS;
        }
    }
}


function update_water(x, y, i) {
    if (world[y][x] == WATER && world[y + 1][x] == AIR) {
        world[y][x] = AIR;
        world[y + 1][x] = WATER;
    }

    if (i) {

        if (world[y][x + 1] == AIR && world[y][x] == WATER) {
            world[y][x] = AIR;
            world[y][x + 1] = WATER;
        }
        if (world[y][x - 1] == AIR && world[y][x] == WATER) {
            world[y][x] = AIR;
            world[y][x - 1] = WATER;
        }
    } else {

        if (world[y][x - 1] == AIR && world[y][x] == WATER) {
            world[y][x] = AIR;
            world[y][x - 1] = WATER;
        }
        if (world[y][x + 1] == AIR && world[y][x] == WATER) {
            world[y][x] = AIR;
            world[y][x + 1] = WATER;
        }
    }
}


function paint(x, y, radius, brush) {

    for (let i = 0; i < 10; i++) {
        let a = Math.random() * Math.PI * 2;
        let r = Math.random() * radius;
        let yy = Math.floor(y + Math.sin(a) * r);
        let xx = Math.floor(x + Math.cos(a) * r);
        if (yy >= 0 && yy < H && xx >= 0 && x < W) {
            world[yy][xx] = brush;
        }
    }

}

function simulate() {

    // paint();

    for (let y = H - 2; y > 1; y--) {
        for (let x = 1; x < W - 1; x++) {
            if (world[y][x] == AIR) {
                continue;
            }
            update_sand(x, y);
            update_wood(x, y);
            update_plant(x, y);
        }
    }
    for (let k = 0; k < 4; k++) {
        for (let y = H - 2; y > 1; y--) {
            for (let x = 1; x < W - 1; x++) {
                if (world[y][x] == AIR) {
                    continue;
                }
                update_water(x, y, true);
            }
        }
        for (let y = H - 2; y > 1; y--) {
            for (let x = W - 2; x > 1; x--) {
                if (world[y][x] == AIR) {
                    continue;
                }
                update_water(x, y, false);
            }
        }
    }

    // draw
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (world[y][x] != prev_world[y][x]) {
                const cols = PALETTE[world[y][x]];
                fbctx.fillStyle = cols[Math.floor(Math.random() * cols.length)];
                fbctx.fillRect(x, y, 1, 1);
                prev_world[y][x] = world[y][x];
            }
        }
    }

    ctx.drawImage(fb, 0, 0);
}
