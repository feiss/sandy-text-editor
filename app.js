// diegofg.com

// if sand can be also spawn with mouse
let options = {
    sandy_mouse: false,
}


const $ = q => document.querySelector(q);
const $$ = q => document.querySelectorAll(q);
const $c = el => document.createElement(el);

const W = 362;
const H = 200;
let window_ratio = 1;
let canvas, ctx;
let cursor = { x: 0, y: 0, col: 0, line: 0, caret: true };
let lines;

const CHARS = ' abcdefghijklmnopqrstuvwxyz0123456789!,.-_=?+`":;@#$%&*()<>\'/[]{}|';
const MARGIN = 5;
const LINE_HEIGHT = 10;
const CHARW = 6;
const CHARH = 8;
const MAX_LINES = 19;
const MAX_COLS = Math.floor((W - MARGIN * 2) / CHARW);
const LOAD_FILE = "";//"En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lentejas los viernes, algún palomino de añadidura los domingos, consumían las tres partes de su hacienda. El resto della concluían sayo de velarte, calzas de velludo para las fiestas con sus pantuflos de lo mismo, los días de entre semana se honraba con su vellori de lo más fino. Tenía en su casa una ama que pasaba de los cuarenta, y una sobrina que no llegaba a los veinte, y un mozo de campo y plaza, que así ensillaba el rocín como tomaba la podadera. Frisaba la edad de nuestro hidalgo con los cincuenta años, era de complexión recia, seco de carnes, enjuto de rostro; gran madrugador y amigo de la caza. Quieren decir que tenía el sobrenombre de Quijada o Quesada (...)"


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


const BLANK = { brush: AIR, ch: ' ' };
let KEYWORDS = {};
KEYWORDS[SAND] = 'sand,beach'.split(',');
KEYWORDS[WATER] = 'water,river,sea,ocean,h2o,flow,liquid'.split(',');
// KEYWORDS[STONE] = ''.split(','); // stone doesn't fall, not good for this
KEYWORDS[EARTH] = 'earth,soil,dirt,floor,ground'.split(',');
KEYWORDS[GRASS] = 'grass,green,field,country'.split(',');


function init() {
    canvas = $('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';

    options.sandy_mouse = $('#sandymouse').checked;

    document.addEventListener('keydown', on_key_down);
    canvas.addEventListener('mousedown', on_mouse);
    document.addEventListener('mouseup', on_mouse);
    document.addEventListener('mousemove', on_mouse);
    window.addEventListener('resize', onresize);
    onresize();
    setInterval(() => {
        cursor.caret = !cursor.caret;
    }, 500);
    setup_drag_n_drop();
    new_file();
    load_file(LOAD_FILE);

    fb = new OffscreenCanvas(W, H);
    fbctx = fb.getContext('2d', { antialias: false, alpha: false });

    requestAnimationFrame(draw);
}

document.onload = init();


function new_file() {
    lines = new Array(MAX_LINES);
    for (let i = 0; i < lines.length; i++) {
        lines[i] = new Array(MAX_COLS);
        lines[i].fill(BLANK);
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

    cursor = { x: 0, y: 0, col: 0, line: 0, caret: true };

}

function load_file(file) {

    const sanitize = ch => {
        ch = ch.toLowerCase();
        const from = 'áéíóúñâêîôûäëïöü';
        const to = 'aeiounaeiouaeiou';
        const pos = from.indexOf(ch);
        if (pos !== -1) return to[pos];
        if (CHARS.indexOf(ch) !== -1) {
            return ch;
        }
        return '?';
    }

    let line = 0;
    let col = 0;
    for (let ch of file) {
        if (ch == '\r') continue;
        if (ch == '\t') {
            col += 2;
        } if (ch == '\n') {
            col = 0;
            line++;
            if (line >= MAX_LINES) {
                break;
            }
        } else {
            lines[line][col] = { brush: SAND, ch: sanitize(ch) };
        }
        col++;
        if (col >= MAX_COLS) {
            col = 0;
            line++
            if (line >= MAX_LINES) {
                break;
            }
        }
    }
}

function setup_drag_n_drop() {
    let dropZone = document.body;
    dropZone.addEventListener('dragover', function (e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    dropZone.addEventListener('drop', function (e) {
        e.stopPropagation();
        e.preventDefault();
        let files = e.dataTransfer.files;
        if (files.length == 0) { return; }

        let reader = new FileReader();
        reader.onload = function (e2) {
            load_file(e2.target.result);
        }
        reader.readAsText(files[0]);
    });


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
        Math.max(0, Math.min(MAX_LINES - 1, Math.floor((y - MARGIN) / LINE_HEIGHT))),
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
    if (cursor.caret) {
        ctx.fillStyle = PALETTE[brush_on_pos(cursor.line, cursor.col)][0];
        ctx.fillRect(cursor.x - 1, cursor.y, 1, CHARH);
    }

}

/// EDITOR STUFF

function draw_editor() {
    for (let line in lines) {
        for (let col in lines[line]) {
            // brush = update_editor_brush_from_keywords(brush, lines[line].join('').substr(col));
            draw_char(coords2xy(line, col), lines[line][col], true);
        }
    }
}

function colorize_line(line) {
    let brush = SAND;
    let str = lines[line].map(c => c.ch).join("");

    for (let s = 0; s < str.length; s++) {
        let found = false;
        for (let category in KEYWORDS) {
            for (let i in KEYWORDS[category]) {
                const keyword = KEYWORDS[category][i];
                if (str.substr(s, KEYWORDS[category][i].length) == keyword) {
                    brush = category;
                    for (let j = 0; j < keyword.length; j++) {
                        lines[line][s + j].brush = brush;
                    }
                    s += keyword.length;
                    found = true;
                }
            }
        }
        if (!found) {
            lines[line][s].brush = brush;
        }
    }
}

function draw_char(coords, char, in_editor) {
    const { brush, ch } = char;
    const glyph = FONT[ch] || '0000000000111100001001000010010000100100001001000011110000000000';
    if (ch == '' || ch == ' ') return;
    for (let y = 0, i = 0; y < CHARH; y++) {
        for (let x = 0; x < CHARW; x++, i++) {
            if (in_editor) {
                ctx.fillStyle = (glyph[i] == '1') ? PALETTE[brush][0] : PALETTE[AIR];
                ctx.fillRect(coords[0] + x, coords[1] + y, 1, 1);
            } else {
                if (glyph[i] == '1') {
                    world[coords[1] + y][coords[0] + x] = brush;
                }
            }
        }
    }
}

function brush_on_pos(line, col) {
    let brush = lines[line][col].brush;
    if (brush == AIR) return SAND;
    return brush;
}

function on_mouse(ev) {
    painting = ev.buttons == 1;
    if (painting) {
        const mx = Math.floor(ev.offsetX * window_ratio);
        const my = Math.floor(ev.offsetY * window_ratio);
        [cursor.line, cursor.col] = xy2coords(mx, my);
        cursor.caret = true;

        if (options.sandy_mouse) {

            paint(mx, my + CHARH, 2, brush_on_pos(cursor.line, cursor.col));
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
    else if (ev.key == 'ArrowUp') {
        if (cursor.line > 0) cursor.line--;
    }
    else if (ev.key == 'ArrowDown') {
        if (cursor.line < MAX_LINES - 1) cursor.line++;
    }
    else if (ev.key == 'Backspace') {
        if (cursor.col > 0) {
            cursor.col--;
            const deleted = lines[cursor.line].splice(cursor.col, 1);
            add_letters_to_world(deleted, cursor.line, cursor.col);
            lines[cursor.line].push(BLANK);
            colorize_line(cursor.line);
        } else if (cursor.line > 0) {
            cursor.line--;
            cursor.col = last_col_in_line(cursor.line);
        }
    }
    else if (ev.key == 'Delete') {
        const deleted = lines[cursor.line].splice(cursor.col, 1);
        add_letters_to_world(deleted, cursor.line, cursor.col);
        lines[cursor.line].push(BLANK);
        colorize_line(cursor.line);
    }
    else if (ev.key == 'Enter') {
        if (ev.shiftKey) {
            const deleted = lines[cursor.line].splice(0, MAX_COLS);
            add_letters_to_world(deleted, cursor.line, 0);
            lines[cursor.line] = new Array(MAX_COLS);
            lines[cursor.line].fill(BLANK);
        }
        move_enter();
    }
    else if (ev.key == 'Escape') {
        // delete all
        for (let line in lines) {
            add_letters_to_world(lines[line], line, 0);
            lines[line].fill(BLANK);
            cursor.col = 0;
            cursor.line = 0;
        }

    }
    else if (CHARS.indexOf(ev.key.toLowerCase()) !== -1) { // valid printable char
        if (ev.key == 'r' && ev.ctrlKey) {
            return;
        }
        let ok = true;
        if (cursor.x >= W - CHARW) {
            ok = move_enter();
        }
        if (ok) {
            lines[cursor.line][cursor.col] = { brush: SAND, ch: ev.key.toLowerCase() };
            colorize_line(cursor.line);
            cursor.col++;
            ev.preventDefault();
            ev.stopPropagation();

        }

    }
    cursor.caret = true;
}

function last_col_in_line(line) {
    let col = MAX_COLS - 1;
    while (col > 0) {
        if (lines[line][col].ch != ' ') { break; }
        col--;
    }
    return col + 1;
}

function move_enter() {
    if (cursor.line < MAX_LINES - 1) {
        cursor.line++;
        cursor.col = 0;
        return true;
    }
    return false;
}


/// SIM STUFF

function add_letters_to_world(letters, line, col) {
    for (let l in letters) {
        draw_char(coords2xy(line, col), letters[l], false);
        col++;
    }

}

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
    for (let k = 0; k < 2; k++) {
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
