import { Player } from './player.js';
import { T, BLOB_COLORS, NPC_CHATS } from './constants.js';
import { CharRender } from './char-render.js';
import { Templates, parseTemplate } from './templates.js';
import { OTP } from './otp.js';
import { Inventory } from './inventory.js';
import { Vote } from './vote.js';
import { DB } from './db.js';

// Forward references
let Nav = null;
export function setNav(n) { Nav = n; }
let WaitingRoom = null;
export function setWaitingRoom(w) { WaitingRoom = w; }
let setupEditorKeys = null;
export function setSetupEditorKeys(fn) { setupEditorKeys = fn; }

// ── Blob sprite generator ──
export function makeBlobSprite(color, size) {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d'), r = size * 0.38;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(size/2, size*0.55, r, r*0.9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(size*0.38, size*0.48, size*0.08, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(size*0.62, size*0.48, size*0.08, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2D3436';
    ctx.beginPath(); ctx.arc(size*0.40, size*0.49, size*0.04, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(size*0.64, size*0.49, size*0.04, 0, Math.PI*2); ctx.fill();
    return c;
}

// =========================================================
// PICO PARK – 25-player cooperative platformer
// =========================================================
export const Game = {
    cvs:null, ctx:null,
    // World dimensions (scrollable)
    W:1600, H:600, VW:800, VH:600,
    running:false, completed:false,
    remaining:300, totalStudents:25,
    timerRef:null, animRef:null, keys:{},
    npcs:[], player:null, particles:[], chatBubbles:[],
    camera:{x:0, y:0},

    // ── Pico Park state ──
    stage:0,        // current stage index
    stageData:null, // current stage config
    stageKeys:[],   // [{x, y, w, h, collected:bool}, ...]
    door:null,      // {x, y, w, h, open:bool}
    pushBlocks:[],  // {x, y, w, h, required, pushers:Set}
    plates:[],      // {x, y, w, h, active, linkedId, type}
    bridges:[],     // {x, y, w, h, visible, linkedId}
    elevators:[],   // {x, y, w, h, minY, maxY, required, riders, dir}
    hazards:[],     // {x, y, w, h, type:'spike'|'lava'}
    platforms:[],   // {x, y, w, h, color, type}
    playersAtDoor:0,
    totalPlayers:0,
    ghostMode:false,
    deadPlayers:new Set(), // indices of dead NPCs

    // Reward
    CLEAR_REWARD: 50,
    victoryTimer: 0,
    doorLockCooldown: 0,

    // Game mode
    spectatorMode: false,
    _followTarget: null,     // 추적 중인 NPC 참조
    _spectatorCamMode: 'free', // 'free' = 전지적 시점 | 'pov' = 플레이어 시점
    gameMode: 'picopark', // 'picopark' | 'numbermatch'
    numberSpots: [],
    nmAllMatched: false,
    nmMatchCount: 0,

    // Camera zoom (1 = no zoom, 1.6 = zoomed in)
    gameZoom: 1.6,
    screenW: 800, screenH: 600, // actual canvas size in CSS px

    // Physics
    GRAVITY: 0.5, JUMP_FORCE: -10, MOVE_SPD: 3.2,

    // ═══════════════════════════════════════
    // STAGE DEFINITIONS
    // ═══════════════════════════════════════
    stages:[
        // ── Stage 1: 열쇠를 모아라! (2 keys, intro) ──
        {
            name:'🔑 열쇠를 모아라!',
            desc:'열쇠 2개를 모두 모아 문을 열자! 협동이 필수!',
            w:1600, h:600,
            spawnX:100, spawnY:500,
            keys:[
                {x:680, y:230, w:24, h:24, gateType:'plate', gateId:'bridge1'},   // key 1: 발판 밟아야
                {x:1220, y:100, w:24, h:24, gateType:'elevator', gateId:0},       // key 2: 엘리베이터 올라가야
            ],
            door:{x:1450, y:440, w:40, h:60},
            platforms:[
                // Ground with gaps (fall = restart from ground)
                {x:0, y:570, w:450, h:30, color:'#4a7c59', type:'ground'},
                {x:560, y:570, w:300, h:30, color:'#4a7c59', type:'ground'},
                {x:970, y:570, w:630, h:30, color:'#4a7c59', type:'ground'},
                // Left steps up – narrower, steeper
                {x:70, y:490, w:90, h:14, color:'#795548', type:'wood'},
                {x:200, y:410, w:80, h:14, color:'#795548', type:'wood'},
                {x:90, y:330, w:90, h:14, color:'#795548', type:'wood'},
                // Plate area (ground level, left)
                {x:350, y:500, w:80, h:14, color:'#795548', type:'wood'},
                // Key 1 platform (across bridge gap) – narrower
                {x:640, y:260, w:100, h:14, color:'#5f3dc4', type:'magic'},
                // Middle elevated section – smaller
                {x:460, y:340, w:80, h:14, color:'#795548', type:'wood'},
                {x:610, y:400, w:70, h:14, color:'#795548', type:'wood'},
                // Right section – elevator zone – narrower
                {x:870, y:450, w:100, h:14, color:'#795548', type:'wood'},
                {x:1060, y:370, w:80, h:14, color:'#795548', type:'wood'},
                // Elevator top landing – narrower
                {x:1170, y:130, w:110, h:14, color:'#e84393', type:'magic'},
                // Right descent to door – narrower, bigger gaps
                {x:1330, y:240, w:80, h:14, color:'#795548', type:'wood'},
                {x:1400, y:350, w:70, h:14, color:'#795548', type:'wood'},
                // Door platform – narrower
                {x:1410, y:500, w:140, h:14, color:'#00897b', type:'nature'},
            ],
            plates:[
                {x:360, y:556, w:40, h:14, linkedId:'bridge1', type:'plate'},
            ],
            bridges:[
                {x:230, y:260, w:120, h:10, visible:false, linkedId:'bridge1'},
            ],
            pushBlocks:[],
            elevators:[
                {x:1110, y:440, w:70, h:12, minY:130, maxY:440, required:4, riders:0, dir:0},
            ],
            hazards:[
                // Ground gap hazards
                {x:450, y:556, w:110, h:14, type:'lava'},
                {x:860, y:556, w:110, h:14, type:'spike'},
                // Mid-path spikes
                {x:750, y:556, w:60, h:14, type:'spike'},
                {x:1250, y:556, w:50, h:14, type:'spike'},
            ]
        },
        // ── Stage 2: 분업과 협동! (4 keys, intermediate) ──
        {
            name:'🧱 분업과 협동!',
            desc:'열쇠 4개! 블록을 밀고, 발판을 밟고, 탑을 쌓아라!',
            w:2000, h:600,
            spawnX:80, spawnY:500,
            keys:[
                {x:592, y:280, w:24, h:24},                                     // key 1: 쌓아야 (3명 스태킹 필수)
                {x:800, y:360, w:24, h:24, gateType:'pushBlock', gateId:0},    // key 2: 블록 밀어야
                {x:1200, y:180, w:24, h:24, gateType:'plate', gateId:'bridge2a'}, // key 3: 발판 밟아야
                {x:1720, y:60, w:24, h:24, gateType:'elevator', gateId:0},     // key 4: 엘리베이터 올라가야
            ],
            door:{x:1850, y:440, w:40, h:60},
            platforms:[
                // Ground with wider gaps
                {x:0, y:570, w:420, h:30, color:'#4a7c59', type:'ground'},
                // Stacking well – 격리된 우물 (key 1: 3명 쌓기 필수)
                {x:525, y:570, w:170, h:14, color:'#795548', type:'wood'},
                {x:525, y:80, w:12, h:490, color:'#636E72', type:'wall'},   // left wall
                {x:683, y:80, w:12, h:490, color:'#636E72', type:'wall'},   // right wall
                {x:750, y:570, w:350, h:30, color:'#4a7c59', type:'ground'},
                {x:1200, y:570, w:800, h:30, color:'#4a7c59', type:'ground'},
                // Left steps – narrower
                {x:60, y:490, w:80, h:14, color:'#795548', type:'wood'},
                {x:180, y:410, w:80, h:14, color:'#795548', type:'wood'},
                // Key 2 area – across gap (push block needed)
                {x:760, y:400, w:90, h:14, color:'#5f3dc4', type:'magic'},
                // Middle zone – dual plates area – narrow
                {x:860, y:460, w:70, h:14, color:'#795548', type:'wood'},
                {x:1010, y:380, w:80, h:14, color:'#795548', type:'wood'},
                // Key 2 platform (via double bridges) – narrow
                {x:1160, y:210, w:100, h:14, color:'#e84393', type:'magic'},
                // Bridge landing pads – narrow
                {x:1060, y:300, w:70, h:14, color:'#5f3dc4', type:'magic'},
                // Right tall tower section – narrow, steep
                {x:1400, y:460, w:80, h:14, color:'#795548', type:'wood'},
                {x:1500, y:370, w:70, h:14, color:'#795548', type:'wood'},
                {x:1560, y:270, w:80, h:14, color:'#5f3dc4', type:'magic'},
                {x:1640, y:170, w:70, h:14, color:'#5f3dc4', type:'magic'},
                // Key 3 tower top – narrow
                {x:1690, y:90, w:70, h:14, color:'#e84393', type:'magic'},
                // Descent to door – narrow, big gaps
                {x:1790, y:280, w:70, h:14, color:'#795548', type:'wood'},
                {x:1830, y:390, w:70, h:14, color:'#795548', type:'wood'},
                // Door platform – narrow
                {x:1810, y:500, w:130, h:14, color:'#00897b', type:'nature'},
            ],
            plates:[
                {x:900, y:556, w:40, h:14, linkedId:'bridge2a', type:'plate'},
                {x:1100, y:556, w:40, h:14, linkedId:'bridge2b', type:'plate'},
                {x:1450, y:556, w:40, h:14, linkedId:'elev2', type:'plate'},
            ],
            bridges:[
                {x:990, y:300, w:70, h:10, visible:false, linkedId:'bridge2a'},
                {x:1110, y:210, w:55, h:10, visible:false, linkedId:'bridge2b'},
            ],
            pushBlocks:[
                {x:350, y:536, w:50, h:34, required:6},
            ],
            elevators:[
                {x:1540, y:450, w:65, h:12, minY:170, maxY:450, required:4, riders:0, dir:0},
            ],
            hazards:[
                {x:420, y:556, w:105, h:14, type:'lava'},
                {x:695, y:556, w:55, h:14, type:'spike'},
                {x:1100, y:556, w:100, h:14, type:'spike'},
                {x:1350, y:556, w:50, h:14, type:'lava'},
                {x:1550, y:556, w:60, h:14, type:'spike'},
            ]
        },
        // ── Stage 3: 최종 관문! (4 keys, advanced) ──
        {
            name:'🏗️ 최종 관문!',
            desc:'열쇠 4개! 모든 협동 기술을 총동원하라!',
            w:2400, h:700,
            spawnX:100, spawnY:600,
            keys:[
                {x:500, y:280, w:24, h:24, gateType:'plate', gateId:'bridge3a'},     // key 1: 발판 밟아야
                {x:1100, y:460, w:24, h:24, gateType:'pushBlock', gateId:0},          // key 2: 블록 밀어야
                {x:1560, y:130, w:24, h:24, gateType:'elevator', gateId:0},            // key 3: 엘리베이터 1
                {x:2060, y:40, w:24, h:24, gateType:'elevator', gateId:1},             // key 4: 엘리베이터 2
            ],
            door:{x:2260, y:520, w:40, h:60},
            platforms:[
                // Ground (with lava gaps – wider)
                {x:0, y:670, w:550, h:30, color:'#4a7c59', type:'ground'},
                {x:700, y:670, w:400, h:30, color:'#4a7c59', type:'ground'},
                {x:1250, y:670, w:350, h:30, color:'#4a7c59', type:'ground'},
                {x:1700, y:670, w:700, h:30, color:'#4a7c59', type:'ground'},
                // === Zone A: Triple plate bridges (key 1) ===
                {x:60, y:580, w:80, h:14, color:'#795548', type:'wood'},
                {x:200, y:490, w:70, h:14, color:'#795548', type:'wood'},
                // Bridge landing steps – narrow
                {x:310, y:400, w:70, h:14, color:'#5f3dc4', type:'magic'},
                {x:430, y:330, w:60, h:14, color:'#5f3dc4', type:'magic'},
                // Key 1 platform – narrow
                {x:470, y:310, w:80, h:14, color:'#e84393', type:'magic'},
                // Descent from key 1 – narrow
                {x:590, y:400, w:70, h:14, color:'#795548', type:'wood'},
                {x:650, y:510, w:80, h:14, color:'#795548', type:'wood'},
                // === Zone B: Push block area (key 2) ===
                {x:860, y:550, w:90, h:14, color:'#795548', type:'wood'},
                // Wall blocking path
                {x:1010, y:490, w:14, h:180, color:'#636E72', type:'wall'},
                {x:1010, y:490, w:80, h:14, color:'#795548', type:'wood'},
                // Key 2 on elevated spot past wall – narrow
                {x:1070, y:490, w:70, h:14, color:'#5f3dc4', type:'magic'},
                // === Zone C: Dual elevator (key 3) ===
                {x:1260, y:540, w:80, h:14, color:'#795548', type:'wood'},
                {x:1400, y:460, w:70, h:14, color:'#795548', type:'wood'},
                // Elevator 1 top landing – narrow
                {x:1430, y:280, w:80, h:14, color:'#5f3dc4', type:'magic'},
                // Elevator 2 top landing + key 3 – narrow
                {x:1520, y:160, w:90, h:14, color:'#e84393', type:'magic'},
                // === Zone D: Summit tower (key 4) – narrow, steep ===
                {x:1710, y:490, w:80, h:14, color:'#795548', type:'wood'},
                {x:1810, y:400, w:70, h:14, color:'#795548', type:'wood'},
                {x:1870, y:310, w:80, h:14, color:'#5f3dc4', type:'magic'},
                {x:1930, y:230, w:70, h:14, color:'#5f3dc4', type:'magic'},
                {x:1970, y:150, w:80, h:14, color:'#e84393', type:'magic'},
                // Key 4 summit – narrow
                {x:2030, y:70, w:70, h:14, color:'#e84393', type:'magic'},
                // Descent to door – narrow, big gaps
                {x:2120, y:180, w:70, h:14, color:'#795548', type:'wood'},
                {x:2160, y:300, w:80, h:14, color:'#795548', type:'wood'},
                {x:2200, y:420, w:70, h:14, color:'#795548', type:'wood'},
                // Door platform – narrow
                {x:2220, y:580, w:120, h:14, color:'#00897b', type:'nature'},
            ],
            plates:[
                // Triple plates for sequential bridges (zone A)
                {x:100, y:656, w:40, h:14, linkedId:'bridge3a', type:'plate'},
                {x:250, y:656, w:40, h:14, linkedId:'bridge3b', type:'plate'},
                {x:400, y:656, w:40, h:14, linkedId:'bridge3c', type:'plate'},
                // Elevator plate (zone C)
                {x:1300, y:656, w:40, h:14, linkedId:'elev3a', type:'plate'},
            ],
            bridges:[
                {x:160, y:400, w:70, h:10, visible:false, linkedId:'bridge3a'},
                {x:270, y:330, w:65, h:10, visible:false, linkedId:'bridge3b'},
                {x:380, y:310, w:55, h:10, visible:false, linkedId:'bridge3c'},
            ],
            pushBlocks:[
                {x:900, y:636, w:60, h:34, required:10},
            ],
            elevators:[
                {x:1430, y:540, w:65, h:12, minY:280, maxY:540, required:6, riders:0, dir:0},
                {x:1530, y:330, w:55, h:12, minY:160, maxY:330, required:4, riders:0, dir:0},
            ],
            hazards:[
                {x:550, y:656, w:150, h:14, type:'lava'},
                {x:1100, y:656, w:150, h:14, type:'lava'},
                {x:1600, y:656, w:100, h:14, type:'spike'},
                {x:1300, y:656, w:70, h:14, type:'spike'},
                {x:1170, y:656, w:50, h:14, type:'lava'},
                {x:1870, y:656, w:80, h:14, type:'spike'},
                {x:2080, y:656, w:70, h:14, type:'lava'},
            ]
        },
    ],

    // ═══════════════════════════════════════
    // NUMBER MATCH STAGES – "숫자를 찾아라!"
    // ═══════════════════════════════════════
    nmStages:[
        // ── Stage 1: 쉬운 출발! ──
        {
            name:'🔢 쉬운 출발!',
            desc:'자기 번호를 찾아 위에 올라서자! 전원이 맞으면 문이 열려요!',
            w:2000, h:800,
            spawnX:100, spawnY:700,
            platforms:[
                // Ground
                {x:0, y:770, w:500, h:30, color:'#4a7c59', type:'ground'},
                {x:550, y:770, w:500, h:30, color:'#4a7c59', type:'ground'},
                {x:1100, y:770, w:500, h:30, color:'#4a7c59', type:'ground'},
                {x:1650, y:770, w:350, h:30, color:'#4a7c59', type:'ground'},
                // Mid tier
                {x:100, y:620, w:180, h:14, color:'#795548', type:'wood'},
                {x:400, y:600, w:180, h:14, color:'#795548', type:'wood'},
                {x:700, y:620, w:180, h:14, color:'#795548', type:'wood'},
                {x:1000, y:610, w:180, h:14, color:'#795548', type:'wood'},
                {x:1350, y:600, w:180, h:14, color:'#5f3dc4', type:'magic'},
                {x:1700, y:620, w:160, h:14, color:'#795548', type:'wood'},
                // Stepping stones
                {x:50, y:700, w:70, h:14, color:'#795548', type:'wood'},
                {x:300, y:680, w:70, h:14, color:'#795548', type:'wood'},
                {x:600, y:690, w:70, h:14, color:'#795548', type:'wood'},
                {x:900, y:680, w:70, h:14, color:'#795548', type:'wood'},
                {x:1200, y:690, w:70, h:14, color:'#795548', type:'wood'},
                {x:1550, y:680, w:70, h:14, color:'#795548', type:'wood'},
                // Top tier
                {x:250, y:430, w:160, h:14, color:'#e84393', type:'magic'},
                {x:650, y:420, w:160, h:14, color:'#e84393', type:'magic'},
                {x:1050, y:440, w:160, h:14, color:'#e84393', type:'magic'},
                {x:1450, y:420, w:160, h:14, color:'#e84393', type:'magic'},
                {x:1800, y:440, w:140, h:14, color:'#e84393', type:'magic'},
                // Top stepping stones
                {x:150, y:530, w:70, h:14, color:'#795548', type:'wood'},
                {x:500, y:520, w:70, h:14, color:'#795548', type:'wood'},
                {x:850, y:530, w:70, h:14, color:'#795548', type:'wood'},
                {x:1250, y:520, w:70, h:14, color:'#795548', type:'wood'},
                {x:1600, y:530, w:70, h:14, color:'#795548', type:'wood'},
                // Door platform
                {x:1900, y:600, w:100, h:14, color:'#00897b', type:'nature'},
            ],
            numberSpots:[
                // 스폰(100,700) 근처에는 숫자 없음! 최소 1~2칸 올라가야 보임
                // Mid tier (y~600-620) — 스폰에서 올라가야 접근
                {x:420,y:600,w:40,h:40,number:1},{x:520,y:600,w:40,h:40,number:2},
                {x:720,y:620,w:40,h:40,number:3},{x:1020,y:610,w:40,h:40,number:4},
                {x:1370,y:600,w:40,h:40,number:5},{x:1720,y:620,w:40,h:40,number:6},
                // Top stepping (y~520-530) — 더 높이 올라가야
                {x:500,y:520,w:40,h:40,number:7},{x:850,y:530,w:40,h:40,number:8},
                {x:1250,y:520,w:40,h:40,number:9},{x:1600,y:530,w:40,h:40,number:10},
                // Top tier (y~420-440) — 가장 높은 곳
                {x:270,y:430,w:40,h:40,number:11},{x:350,y:430,w:40,h:40,number:12},
                {x:670,y:420,w:40,h:40,number:13},{x:750,y:420,w:40,h:40,number:14},
                {x:1070,y:440,w:40,h:40,number:15},{x:1150,y:440,w:40,h:40,number:16},
                {x:1470,y:420,w:40,h:40,number:17},{x:1550,y:420,w:40,h:40,number:18},
                {x:1820,y:440,w:40,h:40,number:19},
                // Ground 먼 곳 (x>700, 스폰 시야 밖)
                {x:700,y:770,w:40,h:40,number:20},{x:900,y:770,w:40,h:40,number:21},
                {x:1130,y:770,w:40,h:40,number:22},{x:1350,y:770,w:40,h:40,number:23},
                {x:1680,y:770,w:40,h:40,number:24},{x:1850,y:770,w:40,h:40,number:25},
            ],
            door:{x:1920,y:540,w:40,h:60},
            hazards:[],
            keys:[],plates:[],bridges:[],pushBlocks:[],elevators:[],
        },
        // ── Stage 2: 한 단계 위로! ──
        {
            name:'🏗️ 한 단계 위로!',
            desc:'위아래로 퍼진 번호판! 내 숫자는 어디에?',
            w:2200, h:700,
            spawnX:100, spawnY:600,
            platforms:[
                // Ground
                {x:0, y:670, w:400, h:30, color:'#4a7c59', type:'ground'},
                {x:500, y:670, w:400, h:30, color:'#4a7c59', type:'ground'},
                {x:1000, y:670, w:400, h:30, color:'#4a7c59', type:'ground'},
                {x:1500, y:670, w:400, h:30, color:'#4a7c59', type:'ground'},
                {x:2000, y:670, w:200, h:30, color:'#4a7c59', type:'ground'},
                // Mid tier
                {x:80, y:500, w:180, h:14, color:'#795548', type:'wood'},
                {x:350, y:480, w:200, h:14, color:'#795548', type:'wood'},
                {x:650, y:500, w:180, h:14, color:'#5f3dc4', type:'magic'},
                {x:950, y:490, w:200, h:14, color:'#795548', type:'wood'},
                {x:1250, y:480, w:180, h:14, color:'#5f3dc4', type:'magic'},
                {x:1550, y:500, w:200, h:14, color:'#795548', type:'wood'},
                {x:1850, y:490, w:180, h:14, color:'#795548', type:'wood'},
                // Top tier
                {x:200, y:320, w:160, h:14, color:'#e84393', type:'magic'},
                {x:550, y:310, w:180, h:14, color:'#e84393', type:'magic'},
                {x:900, y:330, w:160, h:14, color:'#e84393', type:'magic'},
                {x:1250, y:300, w:180, h:14, color:'#e84393', type:'magic'},
                {x:1600, y:320, w:160, h:14, color:'#e84393', type:'magic'},
                {x:1900, y:310, w:140, h:14, color:'#e84393', type:'magic'},
                // Stepping stones
                {x:30, y:580, w:70, h:14, color:'#795548', type:'wood'},
                {x:280, y:400, w:80, h:14, color:'#795548', type:'wood'},
                {x:830, y:400, w:70, h:14, color:'#795548', type:'wood'},
                {x:1130, y:390, w:80, h:14, color:'#795548', type:'wood'},
                {x:1450, y:400, w:70, h:14, color:'#795548', type:'wood'},
                {x:1750, y:580, w:80, h:14, color:'#795548', type:'wood'},
                // Door platform
                {x:2050, y:400, w:100, h:14, color:'#00897b', type:'nature'},
            ],
            numberSpots:[
                // 스폰(100,600) 근처에는 숫자 없음! 올라가거나 멀리 가야 함
                // Mid tier (y~480-500) — x>600만 (스폰 시야 밖)
                {x:680,y:500,w:40,h:40,number:1},{x:990,y:490,w:40,h:40,number:2},
                {x:1290,y:480,w:40,h:40,number:3},{x:1590,y:500,w:40,h:40,number:4},
                {x:1890,y:490,w:40,h:40,number:5},
                // Stepping stones (y~390-400)
                {x:830,y:400,w:40,h:40,number:6},{x:1130,y:390,w:40,h:40,number:7},
                {x:1450,y:400,w:40,h:40,number:8},
                // Top tier (y~300-330)
                {x:230,y:320,w:40,h:40,number:9},{x:580,y:310,w:40,h:40,number:10},
                {x:660,y:310,w:40,h:40,number:11},{x:930,y:330,w:40,h:40,number:12},
                {x:1280,y:300,w:40,h:40,number:13},{x:1630,y:320,w:40,h:40,number:14},
                {x:1930,y:310,w:40,h:40,number:15},
                // Mid tier 왼쪽 (높이 올라가야만 접근)
                {x:480,y:480,w:40,h:40,number:16},{x:390,y:480,w:40,h:40,number:17},
                // Ground 먼 곳 (x>700, 스폰 시야 밖)
                {x:710,y:670,w:40,h:40,number:18},{x:1030,y:670,w:40,h:40,number:19},
                {x:1200,y:670,w:40,h:40,number:20},{x:1520,y:670,w:40,h:40,number:21},
                {x:1610,y:670,w:40,h:40,number:22},{x:1780,y:670,w:40,h:40,number:23},
                {x:2020,y:670,w:40,h:40,number:24},{x:2100,y:670,w:40,h:40,number:25},
            ],
            door:{x:2060,y:340,w:40,h:60},
            hazards:[
                {x:400,y:656,w:100,h:14,type:'spike'},
                {x:900,y:656,w:100,h:14,type:'spike'},
                {x:1400,y:656,w:100,h:14,type:'spike'},
            ],
            keys:[],plates:[],bridges:[],pushBlocks:[],elevators:[],
        },
        // ── Stage 3: 미로 속의 숫자! ──
        {
            name:'🌀 미로 속의 숫자!',
            desc:'복잡한 지형 속에 숨은 번호판! 서둘러 찾아가자!',
            w:2400, h:800,
            spawnX:100, spawnY:700,
            platforms:[
                // Ground with gaps
                {x:0, y:770, w:350, h:30, color:'#4a7c59', type:'ground'},
                {x:450, y:770, w:300, h:30, color:'#4a7c59', type:'ground'},
                {x:850, y:770, w:350, h:30, color:'#4a7c59', type:'ground'},
                {x:1300, y:770, w:300, h:30, color:'#4a7c59', type:'ground'},
                {x:1700, y:770, w:350, h:30, color:'#4a7c59', type:'ground'},
                {x:2150, y:770, w:250, h:30, color:'#4a7c59', type:'ground'},
                // Level 2
                {x:50, y:600, w:200, h:14, color:'#795548', type:'wood'},
                {x:350, y:580, w:180, h:14, color:'#795548', type:'wood'},
                {x:650, y:610, w:200, h:14, color:'#5f3dc4', type:'magic'},
                {x:1000, y:590, w:180, h:14, color:'#795548', type:'wood'},
                {x:1300, y:600, w:200, h:14, color:'#5f3dc4', type:'magic'},
                {x:1600, y:580, w:180, h:14, color:'#795548', type:'wood'},
                {x:1900, y:610, w:200, h:14, color:'#795548', type:'wood'},
                {x:2200, y:590, w:150, h:14, color:'#795548', type:'wood'},
                // Level 3
                {x:120, y:420, w:180, h:14, color:'#e84393', type:'magic'},
                {x:450, y:400, w:160, h:14, color:'#e84393', type:'magic'},
                {x:750, y:430, w:180, h:14, color:'#e84393', type:'magic'},
                {x:1100, y:410, w:160, h:14, color:'#e84393', type:'magic'},
                {x:1400, y:420, w:180, h:14, color:'#e84393', type:'magic'},
                {x:1700, y:400, w:160, h:14, color:'#e84393', type:'magic'},
                {x:2000, y:430, w:180, h:14, color:'#e84393', type:'magic'},
                // Level 4
                {x:250, y:250, w:160, h:14, color:'#e84393', type:'magic'},
                {x:600, y:240, w:140, h:14, color:'#e84393', type:'magic'},
                {x:950, y:260, w:160, h:14, color:'#e84393', type:'magic'},
                {x:1300, y:240, w:160, h:14, color:'#e84393', type:'magic'},
                {x:1650, y:250, w:140, h:14, color:'#e84393', type:'magic'},
                {x:2050, y:260, w:140, h:14, color:'#e84393', type:'magic'},
                // Stepping stones
                {x:30,y:690,w:70,h:14,color:'#795548',type:'wood'},
                {x:300,y:510,w:70,h:14,color:'#795548',type:'wood'},
                {x:550,y:500,w:70,h:14,color:'#795548',type:'wood'},
                {x:900,y:510,w:70,h:14,color:'#795548',type:'wood'},
                {x:1200,y:500,w:70,h:14,color:'#795548',type:'wood'},
                {x:1500,y:510,w:70,h:14,color:'#795548',type:'wood'},
                {x:1850,y:510,w:70,h:14,color:'#795548',type:'wood'},
                {x:160,y:340,w:70,h:14,color:'#795548',type:'wood'},
                {x:500,y:330,w:70,h:14,color:'#795548',type:'wood'},
                {x:850,y:340,w:70,h:14,color:'#795548',type:'wood'},
                {x:1250,y:330,w:70,h:14,color:'#795548',type:'wood'},
                {x:1550,y:340,w:70,h:14,color:'#795548',type:'wood'},
                {x:1900,y:340,w:70,h:14,color:'#795548',type:'wood'},
                // Door platform
                {x:2250,y:500,w:100,h:14,color:'#00897b',type:'nature'},
            ],
            numberSpots:[
                // 스폰(100,700) 근처에는 숫자 없음! 올라가거나 멀리 이동 필수
                // Level 2 (y~580-610) — x>600만 (스폰 시야 밖)
                {x:680,y:610,w:40,h:40,number:1},{x:1030,y:590,w:40,h:40,number:2},
                {x:1330,y:600,w:40,h:40,number:3},{x:1630,y:580,w:40,h:40,number:4},
                {x:1930,y:610,w:40,h:40,number:5},{x:2230,y:590,w:40,h:40,number:6},
                // Level 3 (y~400-430)
                {x:480,y:400,w:40,h:40,number:7},{x:780,y:430,w:40,h:40,number:8},
                {x:1130,y:410,w:40,h:40,number:9},{x:1430,y:420,w:40,h:40,number:10},
                {x:1730,y:400,w:40,h:40,number:11},{x:2030,y:430,w:40,h:40,number:12},
                // Level 4 (y~240-260) — 가장 높은 곳
                {x:280,y:250,w:40,h:40,number:13},{x:630,y:240,w:40,h:40,number:14},
                {x:980,y:260,w:40,h:40,number:15},{x:1330,y:240,w:40,h:40,number:16},
                {x:1680,y:250,w:40,h:40,number:17},{x:2080,y:260,w:40,h:40,number:18},
                // Level 2 왼쪽 (올라가야 접근)
                {x:500,y:500,w:40,h:40,number:19},
                // Ground 먼 곳 (x>850, 스폰 시야 밖)
                {x:880,y:770,w:40,h:40,number:20},{x:1100,y:770,w:40,h:40,number:21},
                {x:1350,y:770,w:40,h:40,number:22},{x:1700,y:770,w:40,h:40,number:23},
                {x:1900,y:770,w:40,h:40,number:24},{x:2180,y:770,w:40,h:40,number:25},
            ],
            door:{x:2260,y:440,w:40,h:60},
            hazards:[
                {x:350,y:756,w:100,h:14,type:'spike'},
                {x:750,y:756,w:100,h:14,type:'lava'},
                {x:1200,y:756,w:100,h:14,type:'spike'},
                {x:1600,y:756,w:100,h:14,type:'lava'},
                {x:2050,y:756,w:100,h:14,type:'spike'},
            ],
            keys:[],plates:[],bridges:[],pushBlocks:[],elevators:[],
        },
    ],

    // ── OTP verification + enter ──
    verifyAndEnter(){
        const input = document.getElementById('otp-input').value.trim();
        const errEl = document.getElementById('otp-error');
        if(!input){
            if(errEl){ errEl.textContent='코드를 입력하세요!'; errEl.classList.remove('hidden'); }
            return;
        }
        if(!OTP.verify(input)){
            if(errEl){ errEl.textContent='코드가 틀렸습니다! 다시 확인하세요.'; errEl.classList.remove('hidden'); }
            document.getElementById('otp-input').value='';
            return;
        }
        if(errEl) errEl.classList.add('hidden');
        const otpEl = document.getElementById('otp-input');
        otpEl.value='';
        otpEl.blur();
        OTP.stop();
        this.totalStudents = parseInt(document.getElementById('s-total').value)||25;
        Player.streak++;
        Player.save();
        Nav.go('waiting-room');
    },

    // ── Spawn effect on attendance ──
    spawnAttendEffect(){
        const effId = Player.equipped.effect;
        if(!effId || !Inventory.EFFECT_COLORS[effId]) return;
        const colors = Inventory.EFFECT_COLORS[effId];
        const cx=this.VW/2, cy=this.VH/2;
        for(let wave=0;wave<3;wave++){
            setTimeout(()=>{
                for(let i=0;i<15;i++){
                    const c=colors[Math.floor(Math.random()*colors.length)];
                    this.particles.push({x:cx+Math.random()*200-100, y:cy+Math.random()*100-50,
                        vx:(Math.random()-.5)*6, vy:-Math.random()*5-2,
                        color:c, size:3+Math.random()*4, life:40+Math.random()*30, maxLife:70});
                }
            }, wave*400);
        }
    },

    // ── Enter from waiting room ──
    enterFromWaitingRoom(gameId){
        this.remaining = 300;
        this.isMultiplayer = true;
        this.totalStudents = WaitingRoom.totalStudents || parseInt(document.getElementById('s-total').value) || 25;
        this.gameMode = gameId || (Math.random() < 0.5 ? 'picopark' : 'numbermatch');
        Nav.go('game');
        // 단체 게임에서는 나가기 버튼 숨김
        const quitBtn = document.querySelector('#game .hud .btn-back');
        if(quitBtn) quitBtn.style.display = 'none';
        document.getElementById('complete-overlay').classList.add('hidden');
        document.getElementById('gacha-overlay').classList.add('hidden');
        // maze는 독립 루프 사용 (attend 연출 없이 바로 시작)
        if(this.gameMode === 'maze'){
            document.getElementById('attend-overlay').classList.add('hidden');
            this.startMaze();
            return;
        }
        document.getElementById('attend-overlay').classList.remove('hidden');
        this.spawnAttendEffect();
        setTimeout(()=>{
            document.getElementById('attend-overlay').classList.add('hidden');
            if(this.gameMode === 'numbermatch') this.startNumberMatch();
            else this.startPicoPark();
        }, 1800);
    },

    // ── 교사 관전 모드 진입 ──
    enterAsSpectator(gameId){
        this.remaining = 300;
        this.isMultiplayer = true;
        this.spectatorMode = true;
        this.totalStudents = WaitingRoom.totalStudents || 25;
        this.gameMode = gameId || 'picopark';
        Nav.go('game');
        const quitBtn = document.querySelector('#game .hud .btn-back');
        if(quitBtn) quitBtn.style.display = 'none';
        document.getElementById('complete-overlay').classList.add('hidden');
        document.getElementById('gacha-overlay').classList.add('hidden');
        document.getElementById('attend-overlay').classList.add('hidden');
        // 관전 배지 표시
        const badge = document.getElementById('spectator-badge');
        if(badge){ badge.classList.remove('hidden'); badge.textContent = '🌐 전지적 시점 · 방향키: 카메라 · 클릭/Tab: 학생 시점 · +/-: 줌'; }
        // 게임 시작
        if(this.gameMode === 'maze'){
            this.startMaze();
            return;
        }
        if(this.gameMode === 'numbermatch') this.startNumberMatch();
        else this.startPicoPark();
    },

    setupSpectatorInput(){
        this.keys = {};
        this._followTarget = null;
        this._spectatorCamMode = 'free';
        this._specKeyDown = e => {
            this.keys[e.key] = true;
            if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
            if(e.key === '=' || e.key === '+') { this.gameZoom = Math.min(3, this.gameZoom + 0.2); this.resize(); }
            if(e.key === '-') { this.gameZoom = Math.max(0.5, this.gameZoom - 0.2); this.resize(); }
            // ESC: 전지적 시점(자유 카메라)으로 복귀
            if(e.key === 'Escape') { this._setSpectatorMode('free', null); }
            // Tab: 다음 학생 POV
            if(e.key === 'Tab') { e.preventDefault(); this._cycleFollowTarget(e.shiftKey ? -1 : 1); }
            // F: 현재 추적 대상의 시점 전환 (전지적 ↔ POV)
            if(e.key === 'f' || e.key === 'F') {
                if(this._followTarget){
                    this._spectatorCamMode = this._spectatorCamMode === 'pov' ? 'free' : 'pov';
                    this._updateSpectatorUI();
                }
            }
        };
        this._specKeyUp = e => { this.keys[e.key] = false; };
        // 캔버스 클릭 → 학생 POV 진입
        this._specClick = e => {
            const cvs = this.cvs;
            if(!cvs) return;
            const rect = cvs.getBoundingClientRect();
            const z = this.gameZoom || 1;
            const dpr = this.dpr || 1;
            const mx = (e.clientX - rect.left) / (rect.width / (cvs.width / dpr)) / z + this.camera.x;
            const my = (e.clientY - rect.top) / (rect.height / (cvs.height / dpr)) / z + this.camera.y;
            let best = null, bestDist = 50;
            for(const n of this.npcs){
                if(n._spectatorDummy || n.enteredDoor) continue;
                const d = Math.hypot(n.x - mx, n.y - my);
                if(d < bestDist){ bestDist = d; best = n; }
            }
            if(best) this._setSpectatorMode('pov', best);
        };
        window.addEventListener('keydown', this._specKeyDown);
        window.addEventListener('keyup', this._specKeyUp);
        if(this.cvs) this.cvs.addEventListener('click', this._specClick);
        this._showStudentList();
    },

    _setSpectatorMode(mode, target){
        if(mode === 'free'){
            this._spectatorCamMode = 'free';
            this._followTarget = null;
        } else {
            this._spectatorCamMode = 'pov';
            this._followTarget = target;
        }
        this._updateSpectatorUI();
    },

    _cycleFollowTarget(dir){
        const alive = this.npcs.filter(n => !n._spectatorDummy && !n.enteredDoor);
        if(!alive.length) return;
        if(!this._followTarget){
            this._followTarget = dir > 0 ? alive[0] : alive[alive.length-1];
        } else {
            const idx = alive.indexOf(this._followTarget);
            const next = (idx + dir + alive.length) % alive.length;
            this._followTarget = alive[next];
        }
        this._spectatorCamMode = 'pov';
        this._updateSpectatorUI();
    },

    _showStudentList(){
        let panel = document.getElementById('spectator-student-list');
        if(!panel){
            panel = document.createElement('div');
            panel.id = 'spectator-student-list';
            panel.className = 'spectator-student-list';
            document.getElementById('game').appendChild(panel);
        }
        panel.classList.remove('hidden');
        this._updateStudentList();
    },

    _updateSpectatorUI(){
        this._updateSpectatorBadge();
        this._updateStudentList();
    },

    _updateStudentList(){
        const panel = document.getElementById('spectator-student-list');
        if(!panel) return;
        const alive = this.npcs.filter(n => !n._spectatorDummy);
        const isFree = this._spectatorCamMode === 'free';
        const html = [`<div class="ssl-header">📺 관전 모드</div>`];
        html.push(`<div class="ssl-item ssl-mode${isFree ? ' ssl-active' : ''}" data-idx="-1">🌐 전지적 시점</div>`);
        html.push(`<div class="ssl-divider"></div>`);
        html.push(`<div class="ssl-sub">👥 학생 (${alive.length}명) — 클릭: POV</div>`);
        alive.forEach((n, i) => {
            const name = n.displayName || n.name || `학생${i+1}`;
            const active = this._followTarget === n;
            const status = n.enteredDoor ? '🚪' : n.dead ? '💀' : '🟢';
            html.push(`<div class="ssl-item${active ? ' ssl-active' : ''}" data-idx="${i}">${status} ${name}</div>`);
        });
        panel.innerHTML = html.join('');
        panel.querySelectorAll('.ssl-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                if(idx < 0) this._setSpectatorMode('free', null);
                else this._setSpectatorMode('pov', alive[idx] || null);
            });
        });
    },

    _updateSpectatorBadge(){
        const badge = document.getElementById('spectator-badge');
        if(!badge) return;
        if(this._spectatorCamMode === 'pov' && this._followTarget){
            const name = this._followTarget.displayName || this._followTarget.name || '학생';
            badge.textContent = `👁️ ${name} 시점 · ESC: 전지적 시점 · Tab: 다음 학생 · F: 모드 전환`;
        } else {
            badge.textContent = '🌐 전지적 시점 · 방향키: 카메라 · 클릭/Tab: 학생 시점 · +/-: 줌';
        }
    },

    // ── Direct enter (testing) ──
    enter(){
        this.totalStudents = parseInt(document.getElementById('s-total').value)||25;
        this.remaining = 300;
        this.gameMode = Math.random() < 0.5 ? 'picopark' : 'numbermatch';
        Player.streak++;
        Player.save();
        OTP.stop();
        Nav.go('game');
        document.getElementById('attend-overlay').classList.remove('hidden');
        document.getElementById('complete-overlay').classList.add('hidden');
        document.getElementById('gacha-overlay').classList.add('hidden');
        this.spawnAttendEffect();
        setTimeout(()=>{
            document.getElementById('attend-overlay').classList.add('hidden');
            if(this.gameMode === 'numbermatch') this.startNumberMatch();
            else this.startPicoPark();
        }, 1800);
    },

    // ═══════════════════════════════════════
    // PICO PARK START
    // ═══════════════════════════════════════
    startPicoPark(){
        this.stage = 0;
        this.completed = false;
        this.running = true;
        this.ghostMode = false;
        this.victoryTimer = 0;
        this.doorLockCooldown = 0;
        this.deadPlayers = new Set();
        this.particles = [];
        this.chatBubbles = [];
        this.cvs = document.getElementById('game-canvas');
        this.ctx = this.cvs.getContext('2d');
        // HiDPI / Retina support
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        this.loadStage(this.stage);
        this.createNPCs();

        // Create player (관전 모드: 더미 플레이어)
        if(this.spectatorMode){
            this.player = {
                x:-1000, y:-1000, vx:0, vy:0, w:24, h:28,
                onGround:true, dir:1, jumpCount:0, maxJumps:2,
                sprite:null, dead:false, ghostTimer:0, atDoor:false,
                enteredDoor:false, _spectatorDummy:true
            };
            this.totalPlayers = this.npcs.length;
            this.setupSpectatorInput();
        } else {
            const pxData = Player.pixels || parseTemplate(Templates[0]);
            const sd = this.stageData;
            this.player = {
                x:sd.spawnX, y:sd.spawnY, vx:0, vy:0, w:24, h:28,
                onGround:false, dir:1, jumpCount:0, maxJumps:2,
                sprite:CharRender.toOffscreen(pxData,64),
                dead:false, ghostTimer:0, atDoor:false
            };
            this.totalPlayers = this.npcs.length + 1;
            this.setupInput();
        }
        this.resize();

        // Timer
        clearInterval(this.timerRef);
        this.timerRef = setInterval(()=>{
            if(!this.running) return;
            this.remaining--;
            // Ghost mode at 60s remaining
            if(this.remaining <= 60 && !this.ghostMode){
                this.ghostMode = true;
                this.chatBubbles.push({x:this.VW/2,y:100,text:'👻 유령 모드! 죽은 플레이어도 발판을 밟을 수 있어요!',timer:150,follow:null,screen:true});
            }
            this.updateHUD();
            if(this.remaining <= 0) this.endGame(false);
        },1000);
        this.updateHUD();

        // Game loop
        cancelAnimationFrame(this.animRef);
        const loop=()=>{
            if(!document.getElementById('game').classList.contains('active')) return;
            this.update();
            this.render();
            this.animRef=requestAnimationFrame(loop);
        };
        loop();
    },

    // ═══════════════════════════════════════
    // NUMBER MATCH START
    // ═══════════════════════════════════════
    startNumberMatch(){
        this.stage = 0;
        this.completed = false;
        this.running = true;
        this.ghostMode = false;
        this.victoryTimer = 0;
        this.doorLockCooldown = 0;
        this.deadPlayers = new Set();
        this.particles = [];
        this.chatBubbles = [];
        this.nmAllMatched = false;
        this.nmMatchCount = 0;
        this.cvs = document.getElementById('game-canvas');
        this.ctx = this.cvs.getContext('2d');
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        this.loadStage(this.stage);
        this.createNPCs();

        if(this.spectatorMode){
            this.player = {
                x:-1000, y:-1000, vx:0, vy:0, w:24, h:28,
                onGround:true, dir:1, jumpCount:0, maxJumps:2,
                sprite:null, dead:false, ghostTimer:0, atDoor:false,
                enteredDoor:false, _spectatorDummy:true
            };
            this.totalPlayers = this.npcs.length;
            this.assignNumbers();
            this.setupSpectatorInput();
        } else {
            const pxData = Player.pixels || parseTemplate(Templates[0]);
            const sd = this.stageData;
            this.player = {
                x:sd.spawnX, y:sd.spawnY, vx:0, vy:0, w:24, h:28,
                onGround:false, dir:1, jumpCount:0, maxJumps:2,
                sprite:CharRender.toOffscreen(pxData,64),
                dead:false, ghostTimer:0, atDoor:false
            };
            this.totalPlayers = this.npcs.length + 1;
            this.assignNumbers();
            this.setupInput();
        }
        this.resize();

        clearInterval(this.timerRef);
        this.timerRef = setInterval(()=>{
            if(!this.running) return;
            this.remaining--;
            if(this.remaining <= 60 && !this.ghostMode){
                this.ghostMode = true;
                this.chatBubbles.push({x:this.VW/2,y:100,text:'👻 유령 모드! 죽은 플레이어도 번호판에 올라갈 수 있어요!',timer:150,follow:null,screen:true});
            }
            this.updateHUD();
            if(this.remaining <= 0) this.endGame(false);
        },1000);
        this.updateHUD();

        cancelAnimationFrame(this.animRef);
        const loop=()=>{
            if(!document.getElementById('game').classList.contains('active')) return;
            this.update();
            this.render();
            this.animRef=requestAnimationFrame(loop);
        };
        loop();
    },

    assignNumbers(){
        const total = this.npcs.length + 1;
        const nums = [];
        for(let i=1; i<=total; i++) nums.push(i);
        // Fisher-Yates shuffle
        for(let i=nums.length-1; i>0; i--){
            const j = Math.floor(Math.random()*(i+1));
            [nums[i], nums[j]] = [nums[j], nums[i]];
        }
        this.player.assignedNumber = nums[0];
        this.npcs.forEach((n, i) => { n.assignedNumber = nums[i+1]; });
    },

    // ── 인원 기반 스케일링 헬퍼 ──
    getKeyCount(n){
        if(n <= 5)  return 2;
        if(n <= 10) return 3;
        if(n <= 15) return 4;
        if(n <= 20) return 5;
        return 6;
    },
    getCoopRequired(base, n){
        return Math.max(2, Math.round(base * n / 25));
    },
    isKeyUnlocked(key){
        if(!key.gateType) return true; // 게이트 없으면 항상 수집 가능
        if(key.gateType === 'plate'){
            return this.plates.some(p => p.linkedId === key.gateId && p.active);
        }
        if(key.gateType === 'elevator'){
            const elev = this.elevators[key.gateId];
            return elev && elev.y <= elev.minY + 5;
        }
        if(key.gateType === 'pushBlock'){
            const block = this.pushBlocks[key.gateId];
            return block && block.pushed;
        }
        return true;
    },

    loadStage(idx){
        const stageList = this.gameMode === 'numbermatch' ? this.nmStages : this.stages;
        const s = stageList[idx % stageList.length];
        this.stageData = s;
        this.W = s.w; this.H = s.h;
        this.platforms = s.platforms.map(p=>({...p}));
        this.door = s.door ? {...s.door, open:false} : null;
        this.pushBlocks = (s.pushBlocks||[]).map(b=>({...b, pushers:new Set(), pushing:false}));
        this.plates = (s.plates||[]).map(p=>({...p, active:false, stepCount:0}));
        this.bridges = (s.bridges||[]).map(b=>({...b, visible:false}));
        this.elevators = (s.elevators||[]).map(e=>({...e, riders:0, dir:0, baseY:e.maxY}));
        this.hazards = (s.hazards||[]).map(h=>({...h}));

        // ── 피코파크: 인원 기반 열쇠 수 스케일링 + 협동 요구 스케일링 ──
        if(this.gameMode === 'picopark'){
            const baseKeys = (s.keys||[]).map(k=>({...k, collected:false}));
            const need = this.getKeyCount(this.totalPlayers || 25);

            // 추가 열쇠가 필요하면 빈 플랫폼 위에 자동 배치
            if(need > baseKeys.length){
                const usedX = new Set(baseKeys.map(k=>k.x));
                const candidates = this.platforms
                    .filter(p => (p.type==='magic'||p.type==='wood') && !usedX.has(p.x+p.w/2-12))
                    .sort(()=>Math.random()-.5);
                const gateTypes = ['plate','elevator','pushBlock'];
                for(let i=baseKeys.length; i<need && candidates.length; i++){
                    const plat = candidates.pop();
                    // 가장 가까운 협동 장치에 연결
                    let gt='plate', gid=this.plates.length>0 ? this.plates[0].linkedId : 'bridge1';
                    if(this.elevators.length > 0){
                        gt = gateTypes[i % gateTypes.length];
                        if(gt==='elevator') gid = i % this.elevators.length;
                        else if(gt==='pushBlock') gid = i % Math.max(1,this.pushBlocks.length);
                        else gid = this.plates.length > 0 ? this.plates[i % this.plates.length].linkedId : 'bridge1';
                    }
                    baseKeys.push({
                        x: plat.x + plat.w/2 - 12, y: plat.y - 30,
                        w:24, h:24, gateType:gt, gateId:gid, collected:false
                    });
                }
            }
            this.stageKeys = baseKeys.slice(0, need);

            // 협동 요구 인원 스케일링
            const n = this.totalPlayers || 25;
            this.pushBlocks.forEach(b=>{ b.required = this.getCoopRequired(b.required, n); });
            this.elevators.forEach(e=>{ e.required = this.getCoopRequired(e.required, n); });
        } else {
            this.stageKeys = (s.keys||[]).map(k=>({...k, collected:false}));
        }
        // Number match spots
        if(this.gameMode === 'numbermatch'){
            this.numberSpots = (s.numberSpots||[])
                .filter(sp => sp.number <= (this.totalPlayers||25))
                .map(sp => ({...sp, satisfied:false, occupant:null}));
            this.nmAllMatched = false;
            this.nmMatchCount = 0;
        } else {
            this.numberSpots = [];
        }
        this.playersAtDoor = 0;
        this.camera = {x:0, y:0};

        // Show stage name
        const modeEl = document.getElementById('hud-mode');
        if(modeEl) modeEl.textContent = `Stage ${idx+1}: ${s.name}`;

        // Stage intro message
        this.chatBubbles.push({
            x:this.VW/2, y:this.VH/3,
            text:s.desc, timer:180, follow:null, screen:true, big:true
        });
    },

    resize(){
        const wrap = this.cvs.parentElement;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        this.dpr = dpr;
        const w = wrap.clientWidth;
        const h = Math.max(wrap.clientHeight - 80, 300);
        this.screenW = w;
        this.screenH = h;
        // VW/VH = 카메라가 보는 월드 영역 (줌 적용)
        const z = this.gameZoom || 1;
        this.VW = w / z;
        this.VH = h / z;
        this.cvs.width = w * dpr;
        this.cvs.height = h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    createNPCs(){
        this.npcs = [];
        // 관전 모드 + 0명 테스트: NPC 5개로 기본 동작 보장
        let count;
        if(this.spectatorMode && this.totalStudents <= 0){
            count = 5;
        } else {
            count = Math.min(this.totalStudents - 1, 24);
        }
        const shuffled = [...BLOB_COLORS].sort(()=>Math.random()-.5);
        const sd = this.stageData;
        for(let i=0;i<count;i++){
            this.npcs.push({
                x: sd.spawnX + (Math.random()*200-100),
                y: sd.spawnY - Math.random()*20,
                vx:0, vy:0, w:24, h:28,
                onGround:false, dir:Math.random()>.5?1:-1,
                sprite:makeBlobSprite(shuffled[i%shuffled.length],64),
                color:shuffled[i%shuffled.length],
                jumpCount:0, maxJumps:2,
                aiTimer:Math.random()*100|0,
                chatTimer:200+Math.random()*500|0,
                dead:false, ghostTimer:0, atDoor:false,
                // AI state
                aiGoal:null, // 'key','door','plate','push','follow','climb'
                aiTarget:null,
                aiJumpCooldown:0,
                stuckTimer:0, lastX:0,
                // Group assignment (for 5-person puzzles)
                group: Math.floor(i/5),
            });
        }
    },

    setupInput(){
        this.keys = {};
        window.onkeydown = e => {
            this.keys[e.key] = true;
            if(e.key===' '||e.key==='ArrowUp'||e.key==='w'||e.key==='W'){
                e.preventDefault();
                this.playerJump();
            }
        };
        window.onkeyup = e => { this.keys[e.key] = false; };
        // Mobile
        document.querySelectorAll('.ctrl-btn').forEach(btn=>{
            const k=btn.dataset.key;
            const down=e=>{
                e.preventDefault();
                if(k==='left') this.keys['ArrowLeft']=true;
                if(k==='right') this.keys['ArrowRight']=true;
                if(k==='action'){ this.keys[' ']=true; this.playerJump(); }
            };
            const up=()=>{
                if(k==='left') this.keys['ArrowLeft']=false;
                if(k==='right') this.keys['ArrowRight']=false;
                if(k==='action') this.keys[' ']=false;
            };
            btn.onpointerdown=down; btn.onpointerup=up; btn.onpointerleave=up;
        });
    },

    playerJump(){
        const p = this.player;
        if(p.dead && !this.ghostMode) return;
        if(p.jumpCount < p.maxJumps){
            p.vy = this.JUMP_FORCE;
            p.jumpCount++;
            p.onGround = false;
        }
    },

    // ═══════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════
    update(){
        // Victory celebration phase (keep rendering particles/chat)
        if(this.victoryTimer > 0){
            this.victoryTimer--;
            this.particles = this.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=(p.type==='fire'?0.03:0.05);p.life--;return p.life>0;});
            this.chatBubbles = this.chatBubbles.filter(b=>{b.timer--;return b.timer>0;});
            if(this.victoryTimer <= 0){
                this.running = false;
                this.showVictoryReward();
            }
            return;
        }
        if(!this.running) return;

        // Player movement
        this.updatePlayer();
        // NPC AI
        this.updateNPCs();
        // Physics for all entities
        this.applyPhysics();
        // Entity-to-entity collision (stacking!)
        this.resolveEntityCollisions();
        // Game mode specific updates
        if(this.gameMode === 'numbermatch'){
            this.updateNumberSpots();
        } else {
            this.updatePushBlocks();
            this.updatePlates();
            this.updateElevators();
            this.updateKeyDoor();
        }
        // Hazards
        this.updateHazards();
        // Camera
        this.updateCamera();
        // Effect trail on player
        this._spawnEffectTrail();
        // Particles & chat
        this.particles = this.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=(p.type==='fire'?0.03:0.1);p.life--;return p.life>0;});
        this.chatBubbles = this.chatBubbles.filter(b=>{b.timer--;if(b.follow){b.x=b.follow.x;b.y=b.follow.y-20;}return b.timer>0;});
        // Check win
        this.checkStageComplete();
        // HUD progress
        this.updateProgress();
    },

    updatePlayer(){
        if(this.spectatorMode) return;
        const p = this.player;
        if(p.enteredDoor) return;
        if(p.dead && !this.ghostMode) {
            p.ghostTimer--;
            if(p.ghostTimer <= 0) this.respawnEntity(p);
            return;
        }
        const spd = this.MOVE_SPD;
        if(this.keys['ArrowLeft']||this.keys['a']||this.keys['A']){p.vx=-spd;p.dir=-1;}
        else if(this.keys['ArrowRight']||this.keys['d']||this.keys['D']){p.vx=spd;p.dir=1;}
        else p.vx*=0.75;
        if(Math.abs(p.vx)<0.15) p.vx=0;
    },

    updateNPCs(){
        const allKeysCollected = this.stageKeys.length > 0 && this.stageKeys.every(k=>k.collected);
        const doorOpen = this.door && this.door.open;

        this.npcs.forEach((n,idx)=>{
            n.aiTimer++;
            n.chatTimer--;
            if(n.aiJumpCooldown > 0) n.aiJumpCooldown--;

            // Already in door
            if(n.enteredDoor) return;
            // Dead NPC
            if(n.dead && !this.ghostMode){
                n.ghostTimer--;
                if(n.ghostTimer <= 0) this.respawnEntity(n);
                return;
            }

            // Stuck detection
            if(n.aiTimer % 60 === 0){
                if(Math.abs(n.x - n.lastX) < 5) n.stuckTimer++;
                else n.stuckTimer = 0;
                n.lastX = n.x;
            }

            // ── AI Decision ──
            let goal = 'wander';
            let tx = n.x, ty = n.y;

            if(this.gameMode === 'numbermatch'){
                // NUMBER MATCH AI
                if(doorOpen && !n.atDoor){
                    goal = 'door';
                    tx = this.door.x + this.door.w/2;
                    ty = this.door.y;
                } else if(!this.nmAllMatched){
                    const mySpot = this.numberSpots.find(s => s.number === n.assignedNumber);
                    if(mySpot){
                        goal = 'spot';
                        tx = mySpot.x + mySpot.w/2;
                        ty = mySpot.y - 20;
                        // Intelligence varies by group: group0=smart, higher=more confused
                        const intelligence = 1.0 - (n.group * 0.12);
                        if(Math.random() > intelligence && n.aiTimer % 200 < 60){
                            goal = 'wander';
                            tx = n.x + (Math.random()-0.5)*200;
                            ty = n.y;
                        }
                    }
                } else {
                    // Stay on spot
                    const mySpot = this.numberSpots.find(s => s.number === n.assignedNumber);
                    if(mySpot){ tx = mySpot.x + mySpot.w/2; ty = mySpot.y - 20; goal = 'spot'; }
                }
            } else {
            // PICO PARK AI
            // Priority: plates > push blocks > key > door

            // 1. If door is open, go to door
            if(doorOpen && !n.atDoor){
                goal = 'door';
                tx = this.door.x + this.door.w/2;
                ty = this.door.y;
            }
            // 2. If uncollected keys remain, distribute groups to them
            else if(!allKeysCollected){
                const uncollected = this.stageKeys.filter(k=>!k.collected);
                if(uncollected.length > 0 && n.group < uncollected.length){
                    const targetKey = uncollected[n.group % uncollected.length];
                    // Stacking key: no gateType → some NPCs act as "base", others climb
                    if(!targetKey.gateType){
                        const keyGroupNpcs = this.npcs.filter(e=>!e.dead && !e.enteredDoor && (e.group % uncollected.length)===(n.group % uncollected.length));
                        const myIdx = keyGroupNpcs.indexOf(n);
                        if(myIdx >= 0 && myIdx < Math.ceil(keyGroupNpcs.length * 0.6)){
                            // Base NPCs: stand under the key as a "stair"
                            goal = 'stack_base';
                            tx = targetKey.x + targetKey.w/2 + (myIdx - 1) * 8;
                            ty = targetKey.y + 60;
                        } else {
                            // Climber NPCs: try to climb on top of base NPCs
                            goal = 'key';
                            tx = targetKey.x + targetKey.w/2;
                            ty = targetKey.y;
                        }
                    } else {
                        goal = 'key';
                        tx = targetKey.x + targetKey.w/2;
                        ty = targetKey.y;
                    }
                }
            }
            // 3. Assign groups to plates
            else if(!doorOpen){
                const plateIdx = n.group % (this.plates.length || 1);
                if(plateIdx < this.plates.length){
                    const plate = this.plates[plateIdx];
                    if(!plate.active || plate.stepCount < 3){
                        goal = 'plate';
                        tx = plate.x + plate.w/2;
                        ty = plate.y - 10;
                    }
                }
                if(goal === 'wander' && this.pushBlocks.length > 0){
                    const block = this.pushBlocks[0];
                    if(!block.pushed){
                        goal = 'push';
                        tx = block.x - 10;
                        ty = block.y;
                    }
                }
                if(goal === 'wander'){
                    goal = 'follow';
                    tx = this.player.x + (Math.random()-0.5)*60;
                    ty = this.player.y;
                }
            }
            } // end picopark AI

            // ── AI Movement ──
            const dx = tx - n.x;
            const dy = ty - n.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if(goal === 'stack_base'){
                // Stand still under the key as a base for stacking
                if(Math.abs(dx) > 10){
                    n.vx = Math.sign(dx) * 1.2;
                    n.dir = dx > 0 ? 1 : -1;
                } else {
                    n.vx *= 0.3; // stay still
                }
            } else if(dist > 20){
                const speed = 1.5 + Math.random()*0.8;
                n.vx = Math.sign(dx) * speed;
                n.dir = dx > 0 ? 1 : -1;

                // Jump if target is above or stuck
                if((dy < -30 || n.stuckTimer > 2) && n.onGround && n.aiJumpCooldown <= 0){
                    n.vy = this.JUMP_FORCE * (0.85+Math.random()*0.3);
                    n.jumpCount = 1;
                    n.onGround = false;
                    n.aiJumpCooldown = 30 + Math.random()*30|0;
                    n.stuckTimer = 0;
                }
                // Double jump sometimes
                if(!n.onGround && n.jumpCount===1 && dy < -60 && Math.random()<0.05 && n.aiJumpCooldown<=0){
                    n.vy = this.JUMP_FORCE * 0.8;
                    n.jumpCount = 2;
                    n.aiJumpCooldown = 40;
                }
            } else {
                n.vx *= 0.7;
                // Random idle jump
                if(n.onGround && Math.random()<0.01){
                    n.vy = this.JUMP_FORCE * 0.7;
                    n.jumpCount = 1;
                    n.onGround = false;
                }
            }

            // Chat
            if(n.chatTimer <= 0){
                n.chatTimer = 300+Math.random()*600|0;
                const msgs = this.getContextChat(goal);
                this.chatBubbles.push({x:n.x,y:n.y-20,text:msgs[Math.floor(Math.random()*msgs.length)],timer:100,follow:n});
            }
        });
    },

    getContextChat(goal){
        const chats = {
            key:['열쇠 어딨지?','열쇠 찾자!','위로 가야해!','거기다!','올라가자!'],
            stack_base:['올라타!','내 위로!','쌓자!','계단 만들자!','여기 서있을게!'],
            door:['문으로 가자!','빨리빨리!','거의 다 왔어!','이쪽이야!','고고!'],
            plate:['여기 밟아!','내가 밟을게!','발판!','누르고 있을게!','올라타!'],
            push:['같이 밀자!','밀어!','으쌰!','힘내!','가즈아!'],
            follow:['따라와~','같이 가자!','기다려~','ㅋㅋ','어디야?'],
            spot:['내 번호 어디지?','찾았다!','여기인가?','이 번호 맞나?','올라가자!','내 자리!'],
            wander:['ㅋㅋ','심심해~','뭐하지','여기야!','안녕~'],
        };
        return chats[goal] || chats.wander;
    },

    applyPhysics(){
        const all = [this.player, ...this.npcs];
        all.forEach(e=>{
            if(e.enteredDoor) return;
            if(e.dead && !this.ghostMode) return;
            // Gravity
            e.vy += this.GRAVITY;
            if(e.vy > 14) e.vy = 14;
            e.x += e.vx;
            e.y += e.vy;
            // World boundaries
            e.x = Math.max(e.w/2, Math.min(this.W - e.w/2, e.x));
            // Fall off bottom → respawn
            if(e.y > this.H + 50){
                this.killEntity(e);
            }
            // Platform collision
            this.checkPlatforms(e);
            // Bridge collision (only if visible)
            this.bridges.forEach(br=>{
                if(!br.visible) return;
                if(e.vy >= 0 &&
                   e.x+e.w/2 > br.x && e.x-e.w/2 < br.x+br.w &&
                   e.y+e.h >= br.y && e.y+e.h <= br.y+br.h+e.vy+2){
                    e.y = br.y - e.h;
                    e.vy = 0;
                    e.onGround = true;
                    e.jumpCount = 0;
                }
            });
            // Elevator collision
            this.elevators.forEach(elev=>{
                if(e.vy >= 0 &&
                   e.x+e.w/2 > elev.x && e.x-e.w/2 < elev.x+elev.w &&
                   e.y+e.h >= elev.y && e.y+e.h <= elev.y+elev.h+e.vy+2){
                    e.y = elev.y - e.h;
                    e.vy = 0;
                    e.onGround = true;
                    e.jumpCount = 0;
                }
            });
        });
    },

    checkPlatforms(e){
        e.onGround = false;
        for(const p of this.platforms){
            // Wall type: horizontal collision
            if(p.type === 'wall'){
                if(e.x+e.w/2 > p.x && e.x-e.w/2 < p.x+p.w &&
                   e.y+e.h > p.y && e.y < p.y+p.h){
                    // Push out horizontally
                    const fromLeft = (e.x + e.w/2) - p.x;
                    const fromRight = (p.x + p.w) - (e.x - e.w/2);
                    if(fromLeft < fromRight){
                        e.x = p.x - e.w/2;
                    } else {
                        e.x = p.x + p.w + e.w/2;
                    }
                    e.vx = 0;
                }
                continue;
            }
            // Standard platform: top collision only
            if(e.vy >= 0 &&
               e.x+e.w/2 > p.x && e.x-e.w/2 < p.x+p.w &&
               e.y+e.h >= p.y && e.y+e.h <= p.y+p.h+e.vy+2){
                e.y = p.y - e.h;
                e.vy = 0;
                e.onGround = true;
                e.jumpCount = 0;
                return;
            }
        }
    },

    // ── Entity-to-Entity collision (Pico Park stacking!) ──
    resolveEntityCollisions(){
        const all = [this.player, ...this.npcs].filter(e=>!e.enteredDoor && (!e.dead || this.ghostMode));
        const len = all.length;
        for(let i=0;i<len;i++){
            for(let j=i+1;j<len;j++){
                const a=all[i], b=all[j];
                const aL=a.x-a.w/2, aR=a.x+a.w/2, aT=a.y, aB=a.y+a.h;
                const bL=b.x-b.w/2, bR=b.x+b.w/2, bT=b.y, bB=b.y+b.h;
                if(aR<=bL||aL>=bR||aB<=bT||aT>=bB) continue;
                const overlapX = Math.min(aR-bL, bR-aL);
                const overlapY = Math.min(aB-bT, bB-aT);
                if(overlapY < overlapX){
                    if(aB - bT < bB - aT){
                        // A lands on B's head
                        if(a.vy >= 0){
                            a.y = bT - a.h;
                            a.vy = 0;
                            a.onGround = true;
                            a.jumpCount = 0;
                        }
                    } else {
                        // B lands on A's head
                        if(b.vy >= 0){
                            b.y = aT - b.h;
                            b.vy = 0;
                            b.onGround = true;
                            b.jumpCount = 0;
                        }
                    }
                } else {
                    const half = overlapX / 2;
                    if(a.x < b.x){ a.x -= half; b.x += half; }
                    else { a.x += half; b.x -= half; }
                    a.vx *= 0.3; b.vx *= 0.3;
                }
            }
        }
    },

    // ── Push Blocks ──
    updatePushBlocks(){
        this.pushBlocks.forEach(block=>{
            if(block.pushed) return;
            block.pushers.clear();
            const all = [this.player, ...this.npcs].filter(e=>!e.dead || this.ghostMode);
            all.forEach((e,i)=>{
                // Check if entity is touching block from left side and moving right
                const touching = (e.x+e.w/2 >= block.x-5 && e.x+e.w/2 <= block.x+10 &&
                                  e.y+e.h > block.y && e.y < block.y+block.h);
                if(touching && e.vx > 0){
                    block.pushers.add(i);
                }
            });
            // Enough pushers?
            if(block.pushers.size >= block.required){
                block.pushing = true;
                block.x += 1.5;
                // Push block off edge? Mark as done
                if(block.x > this.W + 50) block.pushed = true;
                // Particles
                if(Math.random()<0.3){
                    this.spawnParticles(block.x, block.y+block.h, '#FDCB6E', 2);
                }
            } else {
                block.pushing = false;
            }
        });
    },

    // ── Pressure Plates ──
    updatePlates(){
        this.plates.forEach(plate=>{
            plate.stepCount = 0;
            const all = [this.player, ...this.npcs].filter(e=>!e.dead || this.ghostMode);
            all.forEach(e=>{
                if(e.onGround &&
                   e.x+e.w/2 > plate.x && e.x-e.w/2 < plate.x+plate.w &&
                   Math.abs((e.y+e.h) - plate.y) < 8){
                    plate.stepCount++;
                }
            });
            const wasActive = plate.active;
            plate.active = plate.stepCount > 0;

            // Activate/deactivate linked bridges
            this.bridges.forEach(br=>{
                if(br.linkedId === plate.linkedId){
                    br.visible = plate.active;
                }
            });
            // Activate linked elevators
            this.elevators.forEach(elev=>{
                // Elevators handled separately
            });

            // Sound effect
            if(plate.active && !wasActive){
                this.spawnParticles(plate.x+plate.w/2, plate.y, '#00B894', 6);
            }
        });
    },

    // ── Elevators ──
    updateElevators(){
        this.elevators.forEach(elev=>{
            // Count riders
            let riders = 0;
            const all = [this.player, ...this.npcs].filter(e=>!e.dead || this.ghostMode);
            all.forEach(e=>{
                if(e.onGround &&
                   e.x+e.w/2 > elev.x && e.x-e.w/2 < elev.x+elev.w &&
                   Math.abs((e.y+e.h) - elev.y) < 6){
                    riders++;
                }
            });
            elev.riders = riders;

            // Check if linked plate is active
            let plateActive = false;
            this.plates.forEach(plate=>{
                if(plate.linkedId && plate.linkedId === 'elev' + (this.elevators.indexOf(elev)+1)){
                    plateActive = plate.active;
                }
            });

            // Move elevator
            if(riders >= elev.required || plateActive){
                elev.dir = -1; // go up
                elev.y += elev.dir * 1.5;
                if(elev.y <= elev.minY) { elev.y = elev.minY; elev.dir = 0; }
            } else {
                // Slowly return down
                if(elev.y < elev.maxY){
                    elev.y += 0.5;
                    if(elev.y > elev.maxY) elev.y = elev.maxY;
                }
            }
        });
    },

    // ── Key & Door ──
    updateKeyDoor(){
        if(!this.door) return;

        // Key collection (multiple keys) — 협동 게이트 체크 포함
        const all = [this.player, ...this.npcs].filter(e=>!e.dead);
        this.stageKeys.forEach(key=>{
            if(key.collected) return;
            // 게이트 잠금 상태 캐싱
            key._unlocked = this.isKeyUnlocked(key);
            for(const e of all){
                if(e.x+e.w/2 > key.x && e.x-e.w/2 < key.x+key.w &&
                   e.y+e.h > key.y && e.y < key.y+key.h){
                    // 게이트 조건 미충족 시 수집 불가
                    if(!key._unlocked){
                        // 쿨다운 기반 안내 메시지
                        if(!key._lockMsgCd || key._lockMsgCd <= 0){
                            this.chatBubbles.push({
                                x:this.VW/2, y:this.VH/4,
                                text:'🔒 협동 장치를 먼저 작동시켜야 열쇠를 얻을 수 있어요!',
                                timer:90, follow:null, screen:true
                            });
                            key._lockMsgCd = 120;
                        }
                        break;
                    }
                    key.collected = true;
                    this.spawnParticles(key.x, key.y, '#FFD700', 15);
                    const collected = this.stageKeys.filter(k=>k.collected).length;
                    const total = this.stageKeys.length;
                    if(collected >= total){
                        // All keys collected → open door!
                        this.door.open = true;
                        this.chatBubbles.push({
                            x:this.VW/2, y:this.VH/4,
                            text:'🔑 열쇠 전부 획득! 전원 문으로!',
                            timer:120, follow:null, screen:true, big:true
                        });
                    } else {
                        this.chatBubbles.push({
                            x:this.VW/2, y:this.VH/4,
                            text:`🔑 ${collected}/${total} 열쇠 획득!`,
                            timer:90, follow:null, screen:true, big:true
                        });
                    }
                    break;
                }
            }
            // 쿨다운 감소
            if(key._lockMsgCd > 0) key._lockMsgCd--;
        });

        // Locked door feedback (push back + message)
        if(!this.door.open){
            this.doorLockCooldown = Math.max(0, this.doorLockCooldown-1);
            const all2 = [this.player, ...this.npcs].filter(e=>!e.dead);
            all2.forEach(e=>{
                const atDoor = (e.x+e.w/2 > this.door.x && e.x-e.w/2 < this.door.x+this.door.w &&
                                e.y+e.h > this.door.y && e.y < this.door.y+this.door.h+20);
                if(atDoor){
                    // Push entity back from locked door
                    e.vx = e.x < this.door.x+this.door.w/2 ? -2 : 2;
                    if(this.doorLockCooldown <= 0){
                        const remaining = this.stageKeys.filter(k=>!k.collected).length;
                        this.chatBubbles.push({
                            x:this.VW/2, y:this.VH/4,
                            text:`🔒 열쇠 ${remaining}개를 더 모아야 합니다!`,
                            timer:90, follow:null, screen:true, big:true
                        });
                        this.doorLockCooldown = 120; // 2 second cooldown
                    }
                }
            });
        }

        // Players enter door (disappear inside)
        if(this.door.open){
            this.playersAtDoor = 0;
            const all = [this.player, ...this.npcs].filter(e=>!e.dead);
            all.forEach(e=>{
                if(e.enteredDoor){ this.playersAtDoor++; return; }
                const atDoor = (e.x+e.w/2 > this.door.x && e.x-e.w/2 < this.door.x+this.door.w &&
                                e.y+e.h > this.door.y && e.y < this.door.y+this.door.h+20);
                if(atDoor){
                    e.enteredDoor = true;
                    e.vx = 0; e.vy = 0;
                    this.playersAtDoor++;
                    this.spawnParticles(this.door.x+this.door.w/2, this.door.y+this.door.h/2, '#00B894', 6);
                }
            });
        }
    },

    // ── Number Match: spot checking ──
    updateNumberSpots(){
        if(!this.numberSpots || !this.numberSpots.length) return;
        const all = [this.player, ...this.npcs].filter(e => !e.dead || this.ghostMode);
        let matchCount = 0;
        const aliveCount = all.filter(e => !e.enteredDoor).length;

        this.numberSpots.forEach(spot => {
            spot.occupant = null;
            spot.satisfied = false;
            for(const e of all){
                if(e.enteredDoor) continue;
                const onSpot = (
                    e.x + e.w/2 > spot.x && e.x - e.w/2 < spot.x + spot.w &&
                    Math.abs((e.y + e.h) - spot.y) < 12 && e.onGround
                );
                if(onSpot){
                    spot.occupant = e;
                    if(e.assignedNumber === spot.number){
                        spot.satisfied = true;
                        matchCount++;
                    }
                    break;
                }
            }
        });

        this.nmMatchCount = matchCount;
        const allSatisfied = matchCount >= aliveCount && aliveCount > 0;

        if(allSatisfied && !this.nmAllMatched){
            this.nmAllMatched = true;
            if(this.door) this.door.open = true;
            this.chatBubbles.push({
                x:this.VW/2, y:this.VH/4,
                text:'🎉 전원 매칭 완료! 문이 열렸어요!',
                timer:120, follow:null, screen:true, big:true
            });
            this.numberSpots.forEach(spot => {
                if(spot.satisfied) this.spawnParticles(spot.x+spot.w/2, spot.y-10, '#00B894', 6);
            });
        }

        // Door entry (reuse pattern)
        if(this.door && this.door.open){
            this.playersAtDoor = 0;
            all.forEach(e => {
                if(e.enteredDoor){ this.playersAtDoor++; return; }
                const atDoor = (e.x+e.w/2 > this.door.x && e.x-e.w/2 < this.door.x+this.door.w &&
                                e.y+e.h > this.door.y && e.y < this.door.y+this.door.h+20);
                if(atDoor){
                    e.enteredDoor = true;
                    e.vx = 0; e.vy = 0;
                    this.playersAtDoor++;
                    this.spawnParticles(this.door.x+this.door.w/2, this.door.y+this.door.h/2, '#00B894', 6);
                }
            });
        }
    },

    // ── Hazards ──
    updateHazards(){
        this.hazards.forEach(hz=>{
            const all = [this.player, ...this.npcs];
            all.forEach(e=>{
                if(e.dead || e.enteredDoor) return;
                if(e.x+e.w/2 > hz.x && e.x-e.w/2 < hz.x+hz.w &&
                   e.y+e.h > hz.y && e.y < hz.y+hz.h+5){
                    this.killEntity(e);
                }
            });
        });
    },

    killEntity(e){
        if(e.dead) return;
        e.dead = true;
        e.ghostTimer = 60; // 1 second respawn
        this.spawnParticles(e.x, e.y, '#FF6B6B', 8);
    },

    respawnEntity(e){
        const sd = this.stageData;
        e.dead = false;
        e.x = sd.spawnX + (Math.random()*100-50);
        e.y = sd.spawnY - 30;
        e.vx = 0; e.vy = 0;
        e.jumpCount = 0;
        e.atDoor = false;
        this.spawnParticles(e.x, e.y, '#54A0FF', 6);
    },

    // ── Camera follows player group ──
    updateCamera(){
        if(this.spectatorMode){
            // 추적 대상이 문에 들어갔으면 전지적 시점으로 복귀
            if(this._followTarget && this._followTarget.enteredDoor){
                this._setSpectatorMode('free', null);
            }

            if(this._spectatorCamMode === 'pov' && this._followTarget){
                // ★ POV 모드: 학생이 보는 화면 그대로 재현 (빠른 추적)
                const tx = this._followTarget.x - this.VW/2;
                const ty = this._followTarget.y - this.VH/2;
                const cx = Math.max(0, Math.min(tx, this.W - this.VW));
                const cy = Math.max(0, Math.min(ty, this.H - this.VH));
                this.camera.x += (cx - this.camera.x) * 0.18;
                this.camera.y += (cy - this.camera.y) * 0.18;
            } else {
                // ★ 전지적 시점: 자유 카메라 (방향키/WASD)
                const spd = 6;
                if(this.keys['ArrowLeft']||this.keys['a']||this.keys['A']) this.camera.x -= spd;
                if(this.keys['ArrowRight']||this.keys['d']||this.keys['D']) this.camera.x += spd;
                if(this.keys['ArrowUp']||this.keys['w']||this.keys['W']) this.camera.y -= spd;
                if(this.keys['ArrowDown']||this.keys['s']||this.keys['S']) this.camera.y += spd;
                this.camera.x = Math.max(0, Math.min(this.camera.x, this.W - this.VW));
                this.camera.y = Math.max(0, Math.min(this.camera.y, this.H - this.VH));
            }
            return;
        }
        let targetX, targetY;
        if(this.player.enteredDoor && this.door){
            // Player entered door → camera stays on door area
            targetX = this.door.x + this.door.w/2 - this.VW/2;
            targetY = this.door.y + this.door.h/2 - this.VH/2;
        } else {
            targetX = this.player.x - this.VW/2;
            targetY = this.player.y - this.VH/2;
        }
        const clampX = Math.max(0, Math.min(targetX, this.W - this.VW));
        const clampY = Math.max(0, Math.min(targetY, this.H - this.VH));
        this.camera.x += (clampX - this.camera.x) * 0.08;
        this.camera.y += (clampY - this.camera.y) * 0.08;
    },

    checkStageComplete(){
        if(!this.door || !this.door.open) return;
        const aliveCount = [this.player, ...this.npcs].filter(e=>!e.dead).length;
        const stageList = this.gameMode === 'numbermatch' ? this.nmStages : this.stages;
        if(this.playersAtDoor >= aliveCount && aliveCount > 0){
            this.stage++;
            if(this.stage >= stageList.length){
                this.missionClear();
            } else {
                this.spawnParticles(this.door.x, this.door.y, '#00B894', 20);
                this.chatBubbles.push({
                    x:this.VW/2, y:this.VH/3,
                    text:'🎉 스테이지 클리어! 다음으로!',
                    timer:120, follow:null, screen:true, big:true
                });
                setTimeout(()=>{
                    this.loadStage(this.stage);
                    if(this.gameMode === 'numbermatch') this.assignNumbers();
                    const sd = this.stageData;
                    this.player.x = sd.spawnX;
                    this.player.y = sd.spawnY;
                    this.player.vx=0; this.player.vy=0;
                    this.player.dead = false; this.player.atDoor = false; this.player.enteredDoor = false;
                    this.npcs.forEach(n=>{
                        n.x = sd.spawnX + (Math.random()*200-100);
                        n.y = sd.spawnY - Math.random()*20;
                        n.vx=0; n.vy=0;
                        n.dead=false; n.atDoor=false; n.enteredDoor=false;
                        n.stuckTimer=0;
                    });
                }, 1500);
            }
        }
    },

    updateProgress(){
        const stageList = this.gameMode === 'numbermatch' ? this.nmStages : this.stages;
        let stageProgress;
        if(this.gameMode === 'numbermatch'){
            stageProgress = this.nmAllMatched
                ? 0.5 + 0.5 * (this.playersAtDoor / this.totalPlayers)
                : (this.nmMatchCount / Math.max(this.totalPlayers,1)) * 0.5;
        } else {
            const keysCollected = this.stageKeys.filter(k=>k.collected).length;
            const keysTotal = this.stageKeys.length || 1;
            stageProgress = this.door && this.door.open
                ? 0.5 + 0.5 * (this.playersAtDoor / this.totalPlayers)
                : (keysCollected / keysTotal) * 0.5;
        }
        const totalProgress = (this.stage + stageProgress) / stageList.length;
        document.getElementById('hud-fill').style.width = (totalProgress*100)+'%';
    },

    updateHUD(){
        this.updateProgress();
        const stageList = this.gameMode === 'numbermatch' ? this.nmStages : this.stages;
        const m=Math.floor(this.remaining/60), s=this.remaining%60;
        document.getElementById('hud-timer').textContent = `⏱️ ${m}:${String(s).padStart(2,'0')} / 5:00`;
        document.getElementById('G-coins').textContent = Player.coins;
        const isCleared = Player.clearedGames.includes(this.gameMode);
        const gameInfo = Vote.GAMES.find(g => g.id === this.gameMode);
        const rewardText = isCleared ? '✅ 클리어 완료' : `🪙 현상금: ${gameInfo?.bounty || this.CLEAR_REWARD}코인`;
        if(this.gameMode === 'numbermatch'){
            document.getElementById('hud-stars').textContent = `Stage ${this.stage+1}/${stageList.length}  🔢 매칭: ${this.nmMatchCount}/${this.totalPlayers}  ${rewardText}`;
            const el = document.getElementById('hud-mode');
            if(el && !el.textContent.startsWith('🔢')) el.textContent = '🔢 숫자를 찾아라!';
        } else {
            const keysCollected = this.stageKeys.filter(k=>k.collected).length;
            const keysTotal = this.stageKeys.length;
            document.getElementById('hud-stars').textContent = `Stage ${this.stage+1}/${stageList.length}  🔑 ${keysCollected}/${keysTotal}  ${rewardText}`;
        }
        if(this.ghostMode){
            const el = document.getElementById('hud-mode');
            if(el && !el.textContent.includes('👻')) el.textContent += ' 👻';
        }
    },

    // ═══════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════
    render(){
        const ctx = this.ctx;
        const cam = this.camera;
        const z = this.gameZoom || 1;
        const sw = this.screenW, sh = this.screenH;

        // Sky (화면 전체, 줌 전)
        const grad = ctx.createLinearGradient(0,0,0,sh);
        grad.addColorStop(0,'#0c0c24');
        grad.addColorStop(0.5,'#1a1a3e');
        grad.addColorStop(1,'#16213e');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,sw,sh);

        // === Zoom + Camera transform ===
        ctx.save();
        ctx.scale(z, z);

        // Grid pattern background
        ctx.strokeStyle='rgba(255,255,255,.02)';ctx.lineWidth=1;
        for(let x=(-cam.x%40);x<this.VW;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,this.VH);ctx.stroke();}
        for(let y=(-cam.y%40);y<this.VH;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(this.VW,y);ctx.stroke();}

        // Camera translate (within zoom)
        ctx.save();
        ctx.translate(-cam.x, -cam.y);

        // Platforms
        this.platforms.forEach(p=>{
            if(p.x+p.w < cam.x-50 || p.x > cam.x+this.VW+50) return;
            if(p.type==='wall'){
                ctx.fillStyle='#636E72';
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.fillStyle='#74828A';
                ctx.fillRect(p.x, p.y, p.w, 3);
                return;
            }
            // Shadow
            ctx.fillStyle='rgba(0,0,0,.15)';
            ctx.fillRect(p.x+2,p.y+2,p.w,p.h);
            ctx.fillStyle=p.color;
            if(p.type==='ground'){
                ctx.fillRect(p.x,p.y,p.w,p.h);
                ctx.fillStyle='#6ab04c';
                ctx.fillRect(p.x,p.y,p.w,4);
                // Grass
                ctx.fillStyle='#81C784';
                for(let gx=10;gx<p.w;gx+=25+Math.sin(gx)*5){
                    ctx.fillRect(p.x+gx,p.y-2,2,3);
                }
            } else {
                ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,4);ctx.fill();
                if(p.type==='magic'){
                    ctx.fillStyle='rgba(108,92,231,.08)';
                    ctx.fillRect(p.x-5,p.y-5,p.w+10,p.h+10);
                }
            }
        });

        // ── Number Match: number spots ──
        if(this.gameMode === 'numbermatch'){
            this._renderNumberSpots(ctx);
        }

        // ── Pico Park gimmicks ──
        if(this.gameMode !== 'numbermatch'){
        // Bridges (visible ones)
        this.bridges.forEach(br=>{
            if(!br.visible) return;
            ctx.fillStyle='rgba(0,184,148,.6)';
            ctx.fillRect(br.x, br.y, br.w, br.h);
            ctx.strokeStyle='#00B894';ctx.lineWidth=2;
            ctx.strokeRect(br.x, br.y, br.w, br.h);
            // Glow
            ctx.fillStyle='rgba(0,184,148,.1)';
            ctx.fillRect(br.x-5, br.y-5, br.w+10, br.h+10);
        });

        // Elevators
        this.elevators.forEach(elev=>{
            ctx.fillStyle = elev.riders >= elev.required ? '#00B894' : '#636E72';
            ctx.fillRect(elev.x, elev.y, elev.w, elev.h);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(`${elev.riders}/${elev.required}`, elev.x+elev.w/2, elev.y-4);
            // Rails
            ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(elev.x,elev.minY);ctx.lineTo(elev.x,elev.maxY+elev.h);ctx.stroke();
            ctx.beginPath();ctx.moveTo(elev.x+elev.w,elev.minY);ctx.lineTo(elev.x+elev.w,elev.maxY+elev.h);ctx.stroke();
        });

        // Push Blocks
        this.pushBlocks.forEach(block=>{
            if(block.pushed) return;
            const shaking = block.pushers.size > 0 && block.pushers.size < block.required;
            const sx = shaking ? (Math.random()-0.5)*3 : 0;
            ctx.fillStyle = block.pushing ? '#FDCB6E' : '#8D6E63';
            ctx.fillRect(block.x+sx, block.y, block.w, block.h);
            ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 2;
            ctx.strokeRect(block.x+sx, block.y, block.w, block.h);
            // Number label
            ctx.fillStyle='#fff';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
            ctx.fillText(`${block.pushers.size}/${block.required}`, block.x+block.w/2+sx, block.y+block.h/2+5);
        });

        // Pressure Plates + visual connection to linked keys
        this.plates.forEach(plate=>{
            ctx.fillStyle = plate.active ? '#00B894' : '#E17055';
            ctx.fillRect(plate.x, plate.y, plate.w, plate.active?6:10);

            // Draw connection line from plate to linked key(s)
            const plateCX = plate.x + plate.w/2;
            const plateCY = plate.y;
            this.stageKeys.forEach(key=>{
                if(key.collected) return;
                if(key.gateType !== 'plate' || key.gateId !== plate.linkedId) return;
                const kt = Date.now()*0.004;
                const keyCX = key.x + key.w/2;
                const keyCY = key.y + Math.sin(kt)*5 + key.h/2;
                ctx.save();
                if(plate.active){
                    // Active: bright green chain with particles
                    ctx.strokeStyle='rgba(0,184,148,.6)';
                    ctx.lineWidth=2;
                    ctx.setLineDash([6,4]);
                    ctx.lineDashOffset = -Date.now()*0.05; // animate dash flow
                    ctx.beginPath();ctx.moveTo(plateCX,plateCY);ctx.lineTo(keyCX,keyCY);ctx.stroke();
                    ctx.setLineDash([]);
                    // "Unlocked" burst near key
                    ctx.fillStyle='rgba(0,184,148,.25)';
                    const r = 16 + Math.sin(Date.now()*0.006)*4;
                    ctx.beginPath();ctx.arc(keyCX, keyCY, r, 0, Math.PI*2);ctx.fill();
                    // 🔓 icon near key
                    ctx.globalAlpha=0.9;ctx.font='12px sans-serif';ctx.textAlign='center';
                    ctx.fillText('🔓', keyCX+16, keyCY-8);
                } else {
                    // Inactive: dim dotted line with lock
                    ctx.strokeStyle='rgba(225,112,85,.25)';
                    ctx.lineWidth=1;
                    ctx.setLineDash([3,6]);
                    ctx.beginPath();ctx.moveTo(plateCX,plateCY);ctx.lineTo(keyCX,keyCY);ctx.stroke();
                    ctx.setLineDash([]);
                }
                ctx.restore();
            });

            if(!plate.active){
                ctx.fillStyle='rgba(225,112,85,.2)';
                ctx.fillRect(plate.x-5, plate.y-15, plate.w+10, 20);
                ctx.fillStyle='#E17055';ctx.font='10px sans-serif';ctx.textAlign='center';
                ctx.fillText('▼밟아!', plate.x+plate.w/2, plate.y-5);
            } else {
                // Glow when active
                ctx.fillStyle='rgba(0,184,148,.15)';
                ctx.beginPath();ctx.arc(plate.x+plate.w/2,plate.y,25,0,Math.PI*2);ctx.fill();
            }
        });
        } // end picopark gimmicks

        // Hazards
        this.hazards.forEach(hz=>{
            if(hz.type==='spike'){
                ctx.fillStyle='#636E72';
                for(let sx=hz.x;sx<hz.x+hz.w;sx+=12){
                    ctx.beginPath();
                    ctx.moveTo(sx, hz.y+hz.h);
                    ctx.lineTo(sx+6, hz.y);
                    ctx.lineTo(sx+12, hz.y+hz.h);
                    ctx.closePath(); ctx.fill();
                }
            } else if(hz.type==='lava'){
                ctx.fillStyle='#FF4500';
                ctx.fillRect(hz.x,hz.y,hz.w,hz.h);
                // Bubbles
                const t = Date.now()*0.003;
                ctx.fillStyle='#FF8C00';
                for(let i=0;i<3;i++){
                    const bx = hz.x + hz.w*(0.2+0.3*i) + Math.sin(t+i)*5;
                    const by = hz.y + Math.sin(t*2+i*2)*3;
                    ctx.beginPath();ctx.arc(bx,by,3+Math.sin(t+i),0,Math.PI*2);ctx.fill();
                }
            }
        });

        // Keys (multiple) - picopark only — 잠금/해제 시각 피드백
        if(this.gameMode !== 'numbermatch'){
        this.stageKeys.forEach((key,ki)=>{
            if(key.collected) return;
            const t=Date.now()*0.004 + ki*1.5;
            const ky = key.y + Math.sin(t)*5;
            const unlocked = key._unlocked !== undefined ? key._unlocked : this.isKeyUnlocked(key);
            const cx = key.x+key.w/2, cy = ky+key.h/2;
            ctx.save();
            if(!unlocked){
                // 잠긴 열쇠: 반투명 + 회색 톤
                ctx.globalAlpha = 0.4;
                ctx.font='24px sans-serif';ctx.textAlign='center';
                ctx.fillText('🔑', cx, cy+8);
                // 자물쇠 아이콘
                ctx.globalAlpha = 0.8;
                ctx.font='14px sans-serif';
                ctx.fillText('🔒', cx+14, cy-6);
                // 어두운 글로우
                ctx.globalAlpha = 0.1;
                ctx.fillStyle='rgba(100,100,100,.3)';
                ctx.beginPath();ctx.arc(cx, cy, 18, 0, Math.PI*2);ctx.fill();
            } else {
                // 해제된 열쇠: 밝은 금색 + 반짝 이펙트
                ctx.font='24px sans-serif';ctx.textAlign='center';
                ctx.fillText('🔑', cx, cy+8);
                // 밝은 글로우
                ctx.fillStyle='rgba(255,215,0,.2)';
                ctx.beginPath();ctx.arc(cx, cy, 22+Math.sin(t*2)*6, 0, Math.PI*2);ctx.fill();
                // 반짝 효과
                ctx.fillStyle='rgba(255,255,200,.3)';
                ctx.beginPath();ctx.arc(cx+Math.cos(t*3)*8, cy+Math.sin(t*3)*8, 3, 0, Math.PI*2);ctx.fill();
                // 쌓기 힌트: gateType 없는 높은 열쇠
                if(!key.gateType){
                    ctx.globalAlpha = 0.7 + Math.sin(t*2)*0.3;
                    ctx.font='bold 11px sans-serif';ctx.textAlign='center';
                    ctx.fillStyle='#FDCB6E';
                    ctx.fillText('↑쌓아!', cx, cy+28);
                    // 쌓기 실루엣 힌트 (아래에 작은 사람 아이콘들)
                    ctx.globalAlpha = 0.3;
                    ctx.font='14px sans-serif';
                    ctx.fillText('🧍', cx-6, cy+50);
                    ctx.fillText('🧍', cx+6, cy+50);
                    ctx.fillText('🧍', cx, cy+36);
                }
            }
            ctx.restore();
        });
        }

        // Door
        if(this.door){
            ctx.fillStyle = this.door.open ? '#00B894' : '#636E72';
            ctx.fillRect(this.door.x, this.door.y, this.door.w, this.door.h);
            ctx.strokeStyle = this.door.open ? '#00E5A0' : '#455A64';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.door.x, this.door.y, this.door.w, this.door.h);
            // Door icon
            ctx.font='20px sans-serif';ctx.textAlign='center';
            ctx.fillText(this.door.open?'🚪':'🔒', this.door.x+this.door.w/2, this.door.y+this.door.h/2+7);
            // Player count at door
            if(this.door.open){
                ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';
                ctx.fillText(`${this.playersAtDoor}/${this.totalPlayers}`, this.door.x+this.door.w/2, this.door.y-8);
                // Waiting indicator when player inside
                if(this.player.enteredDoor && this.playersAtDoor < this.totalPlayers){
                    const remaining = this.totalPlayers - this.playersAtDoor;
                    ctx.fillStyle='rgba(0,0,0,.7)';ctx.font='bold 12px sans-serif';
                    const wtxt = `⏳ ${remaining}명 대기 중...`;
                    const wtw = ctx.measureText(wtxt).width+16;
                    ctx.beginPath();ctx.roundRect(this.door.x+this.door.w/2-wtw/2, this.door.y-35, wtw, 20, 6);ctx.fill();
                    ctx.fillStyle='#FDCB6E';
                    ctx.fillText(wtxt, this.door.x+this.door.w/2, this.door.y-22);
                }
            }
        }

        // ── Entities (sorted by y for depth) ──
        const entities = [];
        if(!this.player.enteredDoor && (!this.player.dead || this.ghostMode)){
            entities.push({...this.player, isPlayer:true, ref:this.player});
        }
        this.npcs.forEach(n=>{
            if(!n.enteredDoor && (!n.dead || this.ghostMode)){
                entities.push({...n, isNpc:true, ref:n});
            }
        });
        entities.sort((a,b)=>a.y-b.y);

        entities.forEach(e=>{
            if(!e.sprite) return; // 관전 더미 플레이어 스킵
            if(e.x < cam.x-60 || e.x > cam.x+this.VW+60) return;
            const ghost = e.ref.dead && this.ghostMode;
            if(ghost) ctx.globalAlpha = 0.4;

            // 추적 중인 NPC 하이라이트
            const isFollowed = this.spectatorMode && this._followTarget === e.ref;
            if(isFollowed){
                ctx.save();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 12;
                ctx.beginPath(); ctx.arc(e.x, e.y-4, 24, 0, Math.PI*2); ctx.stroke();
                ctx.restore();
                // 추적 화살표
                const ay = e.y - 38 + Math.sin(Date.now()*0.005)*3;
                ctx.fillStyle='#FFD700'; ctx.font='14px sans-serif'; ctx.textAlign='center';
                ctx.fillText('▼', e.x, ay);
            }

            const flip = e.dir===-1;
            const S = 40; // 캐릭터 스프라이트 크기
            ctx.save();
            if(flip){ctx.translate(e.x,0);ctx.scale(-1,1);ctx.drawImage(e.sprite,-S/2,e.y-S/2-2,S,S);}
            else ctx.drawImage(e.sprite,e.x-S/2,e.y-S/2-2,S,S);
            ctx.restore();

            if(ghost){
                ctx.font='14px sans-serif';ctx.textAlign='center';
                ctx.fillText('👻',e.x,e.y-12);
            }

            // Player indicator
            if(e.isPlayer && !ghost){
                CharRender.renderHat(ctx, Player.equipped.hat, e.x, e.y-18, 16);
                const ay = e.y-32+Math.sin(Date.now()*0.005)*3;
                ctx.fillStyle='#FDCB6E';ctx.font='14px sans-serif';ctx.textAlign='center';
                ctx.fillText('▼',e.x,ay);
                if(Player.nickname){
                    ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='bold 10px sans-serif';
                    ctx.fillText(Player.nickname,e.x,e.y-22);
                }
            }

            // Number badge (number match mode)
            if(this.gameMode === 'numbermatch' && !ghost && e.ref.assignedNumber){
                const num = e.ref.assignedNumber;
                const badgeY = e.isPlayer ? e.y - 38 : e.y - 24;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.beginPath(); ctx.arc(e.x, badgeY, 10, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#FDCB6E';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(num, e.x, badgeY);
                ctx.textBaseline = 'alphabetic';
            }

            if(ghost) ctx.globalAlpha = 1;
        });

        // Chat bubbles (world space)
        this.chatBubbles.forEach(b=>{
            if(b.screen) return; // screen-space bubbles drawn later
            if(b.x < cam.x-100 || b.x > cam.x+this.VW+100) return;
            ctx.globalAlpha = Math.min(1, b.timer/20);
            ctx.font='bold 10px sans-serif';ctx.textAlign='center';
            const tw = ctx.measureText(b.text).width+12;
            ctx.fillStyle='rgba(0,0,0,.6)';
            ctx.beginPath();ctx.roundRect(b.x-tw/2,b.y-12,tw,17,6);ctx.fill();
            ctx.fillStyle='#fff';
            ctx.fillText(b.text,b.x,b.y);
        });
        ctx.globalAlpha=1;

        // Particles (world space)
        this.particles.forEach(p=>{
            const alpha = p.life/p.maxLife;
            ctx.globalAlpha = alpha;
            if(p.type==='heart'){
                ctx.font=`${10+alpha*4}px sans-serif`;ctx.textAlign='center';ctx.fillText('💖',p.x,p.y);
            } else if(p.type==='sparkle'){
                ctx.fillStyle=p.color;const s=p.size*alpha;
                ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Date.now()*0.005+p.x);
                ctx.fillRect(-s/2,-0.5,s,1);ctx.fillRect(-0.5,-s/2,1,s);ctx.restore();
            } else if(p.type==='fire'){
                ctx.fillStyle=p.color;const s=p.size*alpha;
                ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
            } else if(p.type==='bubble'){
                ctx.strokeStyle=p.color;ctx.lineWidth=1;ctx.globalAlpha=alpha*0.7;
                ctx.beginPath();ctx.arc(p.x,p.y,p.size*alpha,0,Math.PI*2);ctx.stroke();
                ctx.globalAlpha=alpha*0.15;ctx.fillStyle=p.color;ctx.fill();
            } else if(p.type==='leaf'){
                ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Date.now()*0.003+p.x);
                ctx.beginPath();ctx.ellipse(0,0,p.size*alpha,p.size*alpha*0.5,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(p.type==='petal'){
                ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Date.now()*0.002+p.y);
                ctx.beginPath();ctx.ellipse(0,0,p.size*alpha*0.4,p.size*alpha,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(p.type==='snow'){
                ctx.fillStyle=p.color;const s=p.size*alpha;
                ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
            } else if(p.type==='music'){
                ctx.font=`${8+alpha*5}px sans-serif`;ctx.textAlign='center';
                const notes=['♪','♫','♩'];ctx.fillText(notes[Math.floor(p.x)%3],p.x,p.y);
            } else if(p.type==='lightning'){
                ctx.strokeStyle=p.color;ctx.lineWidth=1.5;ctx.globalAlpha=alpha;
                ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+(Math.random()-.5)*8,p.y+(Math.random()-.5)*8);ctx.stroke();
                ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();
            } else if(p.type==='rainbow'){
                ctx.fillStyle=p.color;ctx.globalAlpha=alpha*0.6;const s=p.size*alpha;
                ctx.fillRect(p.x-s/2,p.y-1,s,2);
            } else if(p.type==='aurora'){
                ctx.fillStyle=p.color;ctx.globalAlpha=alpha*0.35;const s=p.size*alpha;
                ctx.beginPath();ctx.ellipse(p.x,p.y,s*1.5,s*0.6,0,0,Math.PI*2);ctx.fill();
            } else if(p.type==='pixel'){
                ctx.fillStyle=p.color;const s=Math.ceil(p.size*alpha);
                ctx.fillRect(Math.floor(p.x),Math.floor(p.y),s,s);
            } else if(p.type==='ghost'){
                ctx.fillStyle=p.color;ctx.globalAlpha=alpha*0.3;const s=p.size*alpha;
                ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
            } else {
                ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);
            }
        });
        ctx.globalAlpha=1;

        ctx.restore(); // === End camera transform ===
        ctx.restore(); // === End zoom transform ===

        // === Screen-space HUD elements (화면 좌표, 줌 없음) ===

        // Screen-space chat (stage announcements)
        this.chatBubbles.forEach(b=>{
            if(!b.screen) return;
            ctx.globalAlpha = Math.min(1, b.timer/30);
            if(b.big){
                ctx.font='bold 18px sans-serif';ctx.textAlign='center';
                const tw = ctx.measureText(b.text).width+30;
                ctx.fillStyle='rgba(0,0,0,.7)';
                ctx.beginPath();ctx.roundRect(sw/2-tw/2,sh/3-15,tw,36,10);ctx.fill();
                ctx.fillStyle='#FDCB6E';
                ctx.fillText(b.text,sw/2,sh/3+8);
            } else {
                ctx.font='bold 13px sans-serif';ctx.textAlign='center';
                const tw = ctx.measureText(b.text).width+16;
                ctx.fillStyle='rgba(0,0,0,.65)';
                ctx.beginPath();ctx.roundRect(sw/2-tw/2,sh/4-10,tw,24,8);ctx.fill();
                ctx.fillStyle='#fff';
                ctx.fillText(b.text,sw/2,sh/4+5);
            }
        });
        ctx.globalAlpha=1;

        // Number match: player number HUD
        if(this.gameMode === 'numbermatch' && this.player.assignedNumber){
            const num = this.player.assignedNumber;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.beginPath(); ctx.roundRect(10, 50, 85, 38, 8); ctx.fill();
            ctx.fillStyle = '#aaa';
            ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText('내 번호:', 18, 65);
            ctx.fillStyle = '#FDCB6E';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText(`#${num}`, 18, 84);
        }

        // Victory celebration overlay
        if(this.victoryTimer > 0){
            const vAlpha = Math.min(1, (180 - this.victoryTimer) / 30); // fade in
            ctx.fillStyle=`rgba(0,0,0,${vAlpha*0.3})`;
            ctx.fillRect(0,0,sw,sh);
            ctx.globalAlpha = vAlpha;
            ctx.font='bold 28px sans-serif';ctx.textAlign='center';
            ctx.fillStyle='#FFD700';
            ctx.fillText('🎉 축하합니다! 🎉',sw/2,sh/2-20);
            ctx.font='bold 16px sans-serif';
            ctx.fillStyle='#fff';
            const vCleared = Player.clearedGames.includes(this.gameMode);
            const vInfo = Vote.GAMES.find(g => g.id === this.gameMode);
            const vBounty = vCleared ? 0 : (vInfo?.bounty || this.CLEAR_REWARD);
            ctx.fillText(vBounty > 0 ? `전원 클리어! 🪙 +${vBounty} 현상금!` : '전원 클리어! (보상 없음)',sw/2,sh/2+15);
            ctx.globalAlpha=1;
        }

        // Ghost mode overlay
        if(this.ghostMode){
            ctx.fillStyle='rgba(84,160,255,.04)';ctx.fillRect(0,0,sw,sh);
            ctx.fillStyle='rgba(84,160,255,.5)';ctx.font='bold 12px sans-serif';ctx.textAlign='center';
            ctx.fillText('👻 유령 모드 – 죽어도 발판을 밟을 수 있어요!',sw/2,sh-12);
        }

        // Minimap
        this._renderMinimap(ctx);
    },

    _renderMinimap(ctx){
        const mw=140, mh=30, mx=this.screenW-mw-10, my=8;
        const scaleX=mw/this.W, scaleY=mh/this.H;
        ctx.fillStyle='rgba(0,0,0,.5)';
        ctx.beginPath();ctx.roundRect(mx,my,mw,mh,4);ctx.fill();
        // Platforms
        ctx.fillStyle='rgba(255,255,255,.15)';
        this.platforms.forEach(p=>{
            if(p.type==='ground') return;
            ctx.fillRect(mx+p.x*scaleX, my+p.y*scaleY, Math.max(p.w*scaleX,1), Math.max(p.h*scaleY,1));
        });
        // Keys / Number spots on minimap
        if(this.gameMode === 'numbermatch'){
            this.numberSpots.forEach(spot=>{
                ctx.fillStyle = spot.satisfied ? '#00B894' : '#6C5CE7';
                ctx.beginPath();ctx.arc(mx+(spot.x+spot.w/2)*scaleX, my+spot.y*scaleY, 1.5, 0, Math.PI*2);ctx.fill();
            });
        } else {
            this.stageKeys.forEach(key=>{
                if(key.collected) return;
                const unlocked = key._unlocked !== undefined ? key._unlocked : this.isKeyUnlocked(key);
                ctx.fillStyle = unlocked ? '#FFD700' : '#888';
                ctx.beginPath();ctx.arc(mx+key.x*scaleX, my+key.y*scaleY, 2, 0, Math.PI*2);ctx.fill();
            });
        }
        // Door
        if(this.door){
            ctx.fillStyle=this.door.open?'#00B894':'#636E72';
            ctx.fillRect(mx+this.door.x*scaleX, my+this.door.y*scaleY, 3, 4);
        }
        // Viewport
        ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1;
        ctx.strokeRect(mx+this.camera.x*scaleX, my+this.camera.y*scaleY, this.VW*scaleX, this.VH*scaleY);
        // Player
        ctx.fillStyle='#FDCB6E';
        ctx.beginPath();ctx.arc(mx+this.player.x*scaleX, my+this.player.y*scaleY, 2.5, 0, Math.PI*2);ctx.fill();
        // NPCs
        ctx.fillStyle='rgba(108,92,231,.6)';
        this.npcs.forEach(n=>{
            if(n.dead && !this.ghostMode) return;
            ctx.beginPath();ctx.arc(mx+n.x*scaleX, my+n.y*scaleY, 1.2, 0, Math.PI*2);ctx.fill();
        });
    },

    _renderNumberSpots(ctx){
        const cam = this.camera;
        const t = Date.now() * 0.003;
        this.numberSpots.forEach(spot => {
            if(spot.x+spot.w < cam.x-50 || spot.x > cam.x+this.VW+50) return;
            const cx = spot.x + spot.w/2;
            const pulse = 0.7 + Math.sin(t + spot.number) * 0.3;
            if(spot.satisfied){
                ctx.fillStyle = `rgba(0,184,148,${0.25*pulse})`;
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 28, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(0,184,148,0.6)';
            } else if(spot.occupant){
                ctx.fillStyle = `rgba(225,112,85,${0.2*pulse})`;
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 28, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(225,112,85,0.6)';
            } else {
                ctx.fillStyle = `rgba(108,92,231,${0.15*pulse})`;
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 25, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(108,92,231,0.5)';
            }
            ctx.beginPath(); ctx.arc(cx, spot.y-5, 18, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = spot.satisfied ? '#00B894' : (spot.occupant ? '#E17055' : '#6C5CE7');
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(cx, spot.y-5, 18, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(spot.number, cx, spot.y-4);
            if(spot.satisfied){
                ctx.fillStyle = '#00B894'; ctx.font = '14px sans-serif';
                ctx.fillText('\u2713', cx+22, spot.y-14);
            } else if(spot.occupant){
                ctx.fillStyle = '#E17055'; ctx.font = '12px sans-serif';
                ctx.fillText('\u2717', cx+22, spot.y-14);
            }
            ctx.textBaseline = 'alphabetic';
        });
    },

    _spawnEffectTrail(){
        if(this.spectatorMode) return;
        const effId = Player.equipped.effect;
        if(!effId || !Inventory.EFFECT_COLORS[effId]) return;
        const P = this.player;
        if(P.dead && !this.ghostMode) return;
        const isMoving = Math.abs(P.vx) > 0.5 || Math.abs(P.vy) > 1;
        const chance = isMoving ? 0.4 : 0.06;
        if(Math.random() > chance) return;
        const colors = Inventory.EFFECT_COLORS[effId];
        const c = colors[Math.floor(Math.random()*colors.length)];
        const base = {x:P.x+(Math.random()-.5)*16, y:P.y+Math.random()*20};
        if(effId==='e_sparkle'){
            this.particles.push({...base,vx:-P.vx*0.2+(Math.random()-.5)*1.5,vy:-Math.random()*1.5-.5,color:c,size:2+Math.random()*3,life:25+Math.random()*20,maxLife:45,type:'sparkle'});
        } else if(effId==='e_heart'){
            this.particles.push({x:P.x+(Math.random()-.5)*20,y:P.y+Math.random()*10,vx:(Math.random()-.5)*1,vy:-Math.random()*2-.8,color:c,size:0,life:35+Math.random()*25,maxLife:60,type:'heart'});
        } else if(effId==='e_fire'||effId==='e_dragon'){
            for(let i=0;i<2;i++) this.particles.push({x:P.x+(Math.random()-.5)*14,y:P.y+15+Math.random()*10,vx:(Math.random()-.5)*1.2,vy:-Math.random()*2.5-1,color:c,size:3+Math.random()*3,life:18+Math.random()*15,maxLife:33,type:'fire'});
        } else if(effId==='e_bubble'){
            this.particles.push({...base,vx:(Math.random()-.5)*.8,vy:-Math.random()*1.5-.3,color:c,size:3+Math.random()*4,life:40+Math.random()*30,maxLife:70,type:'bubble'});
        } else if(effId==='e_leaf'||effId==='e_petal'){
            this.particles.push({...base,vx:(Math.random()-.5)*2,vy:-Math.random()*.5+.5,color:c,size:3+Math.random()*3,life:35+Math.random()*25,maxLife:60,type:effId==='e_petal'?'petal':'leaf'});
        } else if(effId==='e_snow'){
            this.particles.push({x:P.x+(Math.random()-.5)*30,y:P.y-5,vx:(Math.random()-.5)*.6,vy:Math.random()*.8+.3,color:c,size:2+Math.random()*3,life:40+Math.random()*30,maxLife:70,type:'snow'});
        } else if(effId==='e_star'){
            this.particles.push({...base,vx:(Math.random()-.5)*2.5,vy:-Math.random()*3-1,color:c,size:2+Math.random()*3,life:20+Math.random()*20,maxLife:40,type:'sparkle'});
        } else if(effId==='e_music'){
            this.particles.push({x:P.x+(Math.random()-.5)*20,y:P.y,vx:(Math.random()-.5)*1.5,vy:-Math.random()*2-1,color:c,size:0,life:30+Math.random()*20,maxLife:50,type:'music'});
        } else if(effId==='e_lightning'){
            for(let i=0;i<2;i++) this.particles.push({x:P.x+(Math.random()-.5)*10,y:P.y+Math.random()*20,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,color:c,size:2+Math.random()*2,life:8+Math.random()*10,maxLife:18,type:'lightning'});
        } else if(effId==='e_rainbow'){
            this.particles.push({x:P.x-P.vx*2+(Math.random()-.5)*6,y:P.y+10+Math.random()*10,vx:(Math.random()-.5)*.5,vy:-Math.random()*.3,color:c,size:3+Math.random()*3,life:25+Math.random()*15,maxLife:40,type:'rainbow'});
        } else if(effId==='e_aurora'){
            this.particles.push({x:P.x+(Math.random()-.5)*24,y:P.y-5+Math.random()*25,vx:(Math.random()-.5)*.4,vy:-Math.random()*.6-.2,color:c,size:4+Math.random()*4,life:30+Math.random()*25,maxLife:55,type:'aurora'});
        } else if(effId==='e_galaxy'){
            this.particles.push({...base,vx:(Math.random()-.5)*2,vy:(Math.random()-.5)*2,color:c,size:1.5+Math.random()*2.5,life:25+Math.random()*25,maxLife:50,type:'sparkle'});
        } else if(effId==='e_pixel'){
            this.particles.push({...base,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,color:c,size:3+Math.random()*2,life:15+Math.random()*15,maxLife:30,type:'pixel'});
        } else if(effId==='e_ghost'){
            this.particles.push({x:P.x+(Math.random()-.5)*20,y:P.y+Math.random()*15,vx:(Math.random()-.5)*.8,vy:-Math.random()*1-.3,color:c,size:4+Math.random()*4,life:30+Math.random()*20,maxLife:50,type:'ghost'});
        }
    },

    spawnParticles(x,y,color,n){
        for(let i=0;i<n;i++){
            this.particles.push({x,y,vx:(Math.random()-.5)*4,vy:-Math.random()*4-1,color,size:2+Math.random()*3,life:30+Math.random()*20,maxLife:50});
        }
    },

    // ═══════════════════════════════════════
    // GAME END
    // ═══════════════════════════════════════
    missionClear(){
        if(this.completed) return;
        this.completed = true;
        clearInterval(this.timerRef);
        // Keep game running for celebration (victoryTimer handled in update)
        this.victoryTimer = 180; // 3 seconds at 60fps
        // Big celebration message
        this.chatBubbles.push({
            x:this.VW/2, y:this.VH/3,
            text:'🎉 전원 클리어! 축하합니다!',
            timer:200, follow:null, screen:true, big:true
        });
        // Confetti particles at door
        if(this.door){
            for(let i=0;i<50;i++){
                this.particles.push({
                    x: this.door.x + this.door.w/2,
                    y: this.door.y,
                    vx: (Math.random()-.5)*8,
                    vy: -Math.random()*6-2,
                    color: ['#FFD700','#FF6B6B','#54A0FF','#00B894','#FDCB6E','#A29BFE'][Math.floor(Math.random()*6)],
                    size: 3+Math.random()*4,
                    life: 100+Math.random()*80,
                    maxLife: 180
                });
            }
        }
    },

    showVictoryReward(){
        if(this.spectatorMode){
            document.getElementById('complete-emoji').textContent = '🎉';
            document.getElementById('complete-title').textContent = '학생들이 클리어했습니다!';
            document.getElementById('complete-sub').textContent = '관전 종료 — 잠시 후 대시보드로 돌아갑니다';
            document.getElementById('complete-overlay').classList.remove('hidden');
            setTimeout(()=>{ this.quit(); }, 5000);
            return;
        }
        const gameInfo = Vote.GAMES.find(g => g.id === this.gameMode);
        const isCleared = Player.clearedGames.includes(this.gameMode);
        const bounty = isCleared ? 0 : (gameInfo?.bounty || this.CLEAR_REWARD);
        const bonus = Player.streak >= 7 ? 20 : Player.streak >= 3 ? 10 : 0;
        const total = bounty + bonus;

        if(!isCleared && gameInfo) {
            Player.clearedGames.push(this.gameMode);
            DB.saveGameClear(this.gameMode).catch(e => console.warn('Failed to save game clear:', e));
        }

        if(total > 0) { Player.addCoins(total, 'game_clear'); Player.save(); }
        document.getElementById('complete-emoji').textContent = isCleared ? '🎉' : '🏆';
        const gameName = gameInfo?.name || (this.gameMode === 'numbermatch' ? '숫자를 찾아라!' : '피코파크');
        document.getElementById('complete-title').textContent = `${gameName} 클리어!`;
        document.getElementById('complete-sub').textContent = isCleared
            ? `이미 클리어한 게임입니다! (보상 없음)${bonus ? `\n🔥 연속 출석 보너스 +${bonus} 코인` : ''}\n출석 ${Player.streak}일차 🔥`
            : `🪙 현상금 +${bounty} 코인${bonus ? ` (🔥연속 출석 보너스 +${bonus})` : ''} = 총 ${total} 코인 획득!\n출석 ${Player.streak}일차 🔥`;
        document.getElementById('complete-overlay').classList.remove('hidden');
        Confetti.fire();
    },

    endGame(success){
        this.running = false;
        clearInterval(this.timerRef);
        if(this.spectatorMode){
            document.getElementById('complete-emoji').textContent = success ? '🎉' : '⏰';
            document.getElementById('complete-title').textContent = success ? '학생들이 클리어!' : '학생들 시간 초과!';
            document.getElementById('complete-sub').textContent = '관전 종료 — 잠시 후 대시보드로 돌아갑니다';
            document.getElementById('complete-overlay').classList.remove('hidden');
            setTimeout(()=>{ this.quit(); }, 5000);
            return;
        }
        if(!success){
            document.getElementById('complete-emoji').textContent='⏰';
            document.getElementById('complete-title').textContent='시간 초과!';
            document.getElementById('complete-sub').textContent='아쉽다! 내일은 꼭 성공하자! (출석은 완료!)';
            document.getElementById('complete-overlay').classList.remove('hidden');
        }
    },

    quit(){
        const wasSpectator = this.spectatorMode;
        this.spectatorMode = false;
        this.running = false;
        this.isMultiplayer = false;
        clearInterval(this.timerRef);
        cancelAnimationFrame(this.animRef);
        window.onkeydown=null; window.onkeyup=null;
        // 미로 모드 키 리스너 + 관전 클릭 정리
        if(this._mazeKeyDown){ window.removeEventListener('keydown', this._mazeKeyDown); this._mazeKeyDown=null; }
        if(this._mazeKeyUp){ window.removeEventListener('keyup', this._mazeKeyUp); this._mazeKeyUp=null; }
        if(this._mazeSpecClick && this.cvs){ this.cvs.removeEventListener('click', this._mazeSpecClick); this._mazeSpecClick=null; }
        // 관전 모드 키 리스너 + 클릭 리스너 정리
        if(this._specKeyDown){ window.removeEventListener('keydown', this._specKeyDown); this._specKeyDown=null; }
        if(this._specKeyUp){ window.removeEventListener('keyup', this._specKeyUp); this._specKeyUp=null; }
        if(this._specClick && this.cvs){ this.cvs.removeEventListener('click', this._specClick); this._specClick=null; }
        this._followTarget = null;
        this._spectatorCamMode = 'free';
        // 관전 배지 숨기기
        const badge = document.getElementById('spectator-badge');
        if(badge) badge.classList.add('hidden');
        // 학생 목록 패널 숨기기
        const slist = document.getElementById('spectator-student-list');
        if(slist) slist.classList.add('hidden');
        // 나가기 버튼 복원
        const quitBtn = document.querySelector('#game .hud .btn-back');
        if(quitBtn) quitBtn.style.display = '';
        document.getElementById('complete-overlay').classList.add('hidden');
        document.getElementById('gacha-overlay').classList.add('hidden');
        document.getElementById('attend-overlay').classList.add('hidden');
        if(wasSpectator){
            // 교사: 대시보드로 복귀
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('teacher').classList.add('active');
            if(window.Teacher) window.Teacher.init();
            return;
        }
        // 게임 세션 자동 종료 (학생 로비 버튼 비활성화)
        if(Player.className) {
            DB.closeGameSession(Player.className).catch(e => console.warn('closeGameSession:', e));
        }
        if(setupEditorKeys) setupEditorKeys();
        Nav.go('lobby');
    }
};

// Compatibility
export const MapGame = { start(){ Game.enter(); }, quit(){ Game.quit(); } };

// CONFETTI
export const Confetti={fire(){const c=document.getElementById('confetti'),x=c.getContext('2d');c.width=innerWidth;c.height=innerHeight;const ps=[],cols=['#6C5CE7','#A29BFE','#FD79A8','#FDCB6E','#00CEC9','#00B894','#E17055'];for(let i=0;i<120;i++)ps.push({x:Math.random()*c.width,y:Math.random()*c.height-c.height,w:Math.random()*10+4,h:Math.random()*6+2,c:cols[Math.floor(Math.random()*cols.length)],vx:(Math.random()-.5)*5,vy:Math.random()*3+2,r:Math.random()*360,rs:(Math.random()-.5)*12,op:1});let f=0;const mx=150,go=()=>{f++;x.clearRect(0,0,c.width,c.height);ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.06;p.r+=p.rs;if(f>mx*.6)p.op-=.02;x.save();x.translate(p.x,p.y);x.rotate(p.r*Math.PI/180);x.globalAlpha=Math.max(0,p.op);x.fillStyle=p.c;x.fillRect(-p.w/2,-p.h/2,p.w,p.h);x.restore();});if(f<mx)requestAnimationFrame(go);else x.clearRect(0,0,c.width,c.height);};go();}};

window.addEventListener('resize',()=>{document.getElementById('confetti').width=innerWidth;document.getElementById('confetti').height=innerHeight;if(Game.cvs&&Game.running)Game.resize();});
