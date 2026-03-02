import { Player } from './player.js';
import { BLOB_COLORS } from './constants.js';
import { makeBlobSprite } from './game.js';

export const GameStages = {
    // ═══════════════════════════════════════
    // PICOPARK STAGES – "열쇠를 모아라!"
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

    // ── Number assignment (Fisher-Yates shuffle) ──
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
};
