import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { GRID, CANVAS_PX, CELL } from './constants.js';
import { esc } from './sanitize.js';

// Forward references (set from main.js to avoid circular dep)
let Inventory = null;
export function setShopInventory(inv) { Inventory = inv; }
let Marketplace = null;
export function setShopMarketplace(m) { Marketplace = m; }

export const Shop = {
    currentTab:'colors',
    DEPRECIATION: 0.7, // 70% of original price on resale

    // ── Color Editor (mini editor) state ──
    ce: {
        active: false,
        tool: 'pen',
        color: '#6C5CE7',
        trialColor: null,   // color being previewed from shop
        trialId: null,
        pixels: null,        // copy of Player.pixels
        origPixels: null,    // backup for reset
        drawing: false,
    },
    defaultPalette:['#2D3436','#636E72','#B2BEC3','#DFE6E9','#FFFFFF','#D63031','#E17055','#FDCB6E','#FFEAA7','#00B894','#00CEC9','#0984E3','#6C5CE7','#A29BFE','#FD79A8','#E84393','#74B9FF','#FAB1A0','#855E42','#A0522D'],
    allItems:{
        colors:[
            // ── 기본 프리미엄 (50~70코인) ──
            {id:'c_gold',icon:'🟡',name:'골드',desc:'황금빛 럭셔리',price:60,hex:'#FFD700'},
            {id:'c_neon_green',icon:'💚',name:'네온 그린',desc:'형광 초록',price:50,hex:'#39FF14'},
            {id:'c_ice_blue',icon:'🧊',name:'아이스 블루',desc:'시원한 얼음색',price:50,hex:'#00F5FF'},
            {id:'c_hot_pink',icon:'💗',name:'핫 핑크',desc:'강렬한 분홍',price:50,hex:'#FF69B4'},
            {id:'c_sky',icon:'☁️',name:'스카이 블루',desc:'맑은 하늘색',price:50,hex:'#87CEEB'},
            {id:'c_mint',icon:'🍃',name:'민트',desc:'시원한 민트색',price:50,hex:'#98FB98'},
            {id:'c_peach',icon:'🍑',name:'피치',desc:'복숭아색',price:50,hex:'#FFB6C1'},
            {id:'c_coral',icon:'🪸',name:'코랄',desc:'산호색',price:55,hex:'#FF7F50'},
            {id:'c_lavender',icon:'💜',name:'라벤더',desc:'은은한 보라',price:55,hex:'#E6E6FA'},
            {id:'c_cream',icon:'🍦',name:'크림',desc:'부드러운 크림색',price:45,hex:'#FFFDD0'},
            // ── 중급 (70~100코인) ──
            {id:'c_lava',icon:'🌋',name:'용암 레드',desc:'뜨거운 용암색',price:70,hex:'#FF4500'},
            {id:'c_ocean',icon:'🌊',name:'오션 블루',desc:'깊은 바다색',price:70,hex:'#006994'},
            {id:'c_rose',icon:'🌹',name:'로즈',desc:'우아한 장미색',price:70,hex:'#E84393'},
            {id:'c_neon_pink',icon:'🩷',name:'네온 핑크',desc:'형광 핑크',price:75,hex:'#FF6EC7'},
            {id:'c_neon_blue',icon:'🔵',name:'네온 블루',desc:'형광 파랑',price:75,hex:'#4D4DFF'},
            {id:'c_lime',icon:'🍋',name:'라임',desc:'상큼한 라임색',price:65,hex:'#C4E538'},
            {id:'c_sunset',icon:'🌅',name:'선셋 오렌지',desc:'노을빛',price:80,hex:'#FF8C00'},
            {id:'c_plum',icon:'🍇',name:'플럼',desc:'진한 자두색',price:75,hex:'#8E4585'},
            {id:'c_teal',icon:'🩵',name:'틸',desc:'청록빛',price:70,hex:'#008080'},
            {id:'c_salmon',icon:'🐟',name:'연어 핑크',desc:'부드러운 핑크',price:65,hex:'#FFA07A'},
            // ── 고급 (100~150코인) ──
            {id:'c_galaxy',icon:'🌌',name:'갤럭시 퍼플',desc:'은하수 보라',price:120,hex:'#8A2BE2'},
            {id:'c_ruby',icon:'💎',name:'루비 레드',desc:'보석처럼 빛나는 빨강',price:110,hex:'#E0115F'},
            {id:'c_sapphire',icon:'💠',name:'사파이어',desc:'깊고 푸른 보석색',price:110,hex:'#0F52BA'},
            {id:'c_emerald',icon:'🟢',name:'에메랄드',desc:'영롱한 초록 보석',price:110,hex:'#50C878'},
            {id:'c_diamond',icon:'💍',name:'다이아몬드',desc:'투명하게 빛나는 색',price:150,hex:'#B9F2FF'},
            {id:'c_obsidian',icon:'🖤',name:'옵시디언',desc:'깊고 어두운 검정',price:100,hex:'#1A1A2E'},
            {id:'c_aurora',icon:'🌈',name:'오로라 그린',desc:'북극 오로라색',price:130,hex:'#00FF7F'},
            {id:'c_cherry',icon:'🍒',name:'체리',desc:'달콤한 체리색',price:90,hex:'#DE3163'},
            {id:'c_mocha',icon:'☕',name:'모카',desc:'진한 커피색',price:80,hex:'#967969'},
            {id:'c_silver',icon:'🪙',name:'실버',desc:'은빛 메탈릭',price:100,hex:'#C0C0C0'},
            // ── 최고급 (150~250코인) ──
            {id:'c_hologram',icon:'✨',name:'홀로그램 핑크',desc:'빛에 따라 달라보이는 색',price:200,hex:'#FF61D2'},
            {id:'c_void',icon:'🕳️',name:'보이드 블랙',desc:'텅 빈 우주의 색',price:180,hex:'#0D0D0D'},
            {id:'c_plasma',icon:'⚡',name:'플라즈마 블루',desc:'번개빛 파랑',price:200,hex:'#00BFFF'},
            {id:'c_magma',icon:'🔥',name:'마그마',desc:'지구 핵의 색',price:180,hex:'#FF3E00'},
            {id:'c_frost',icon:'❄️',name:'프로스트',desc:'얼어붙은 서리색',price:170,hex:'#A5F2F3'},
        ],
        hats:[
            // ── 기본 모자 (50~80코인) ──
            {id:'h_cap',icon:'🧢',name:'모자',desc:'귀여운 모자',price:60},
            {id:'h_ribbon',icon:'🎀',name:'리본',desc:'예쁜 리본',price:50},
            {id:'h_flower',icon:'🌸',name:'벚꽃',desc:'봄날의 벚꽃',price:70},
            {id:'h_leaf',icon:'🍀',name:'네잎클로버',desc:'행운의 클로버',price:55},
            {id:'h_mushroom',icon:'🍄',name:'버섯',desc:'귀여운 버섯 모자',price:60},
            {id:'h_cherry2',icon:'🍒',name:'체리',desc:'달콤한 체리 장식',price:55},
            // ── 중급 모자 (80~120코인) ──
            {id:'h_star',icon:'⭐',name:'별',desc:'반짝이는 별',price:80},
            {id:'h_moon',icon:'🌙',name:'초승달',desc:'은빛 초승달',price:85},
            {id:'h_sun',icon:'☀️',name:'태양',desc:'빛나는 태양',price:90},
            {id:'h_rainbow',icon:'🌈',name:'무지개',desc:'알록달록 무지개',price:95},
            {id:'h_cloud',icon:'☁️',name:'구름',desc:'솜사탕 구름',price:80},
            {id:'h_snowflake',icon:'❄️',name:'눈꽃',desc:'겨울 눈꽃 장식',price:85},
            {id:'h_fire2',icon:'🔥',name:'불꽃',desc:'뜨거운 불꽃 머리',price:100},
            {id:'h_lightning',icon:'⚡',name:'번개',desc:'번쩍이는 번개',price:95},
            {id:'h_heart',icon:'❤️',name:'하트',desc:'사랑의 하트',price:80},
            // ── 고급 모자 (120~200코인) ──
            {id:'h_crown',icon:'👑',name:'왕관',desc:'황금 왕관',price:150},
            {id:'h_tiara',icon:'👸',name:'티아라',desc:'공주님의 티아라',price:130},
            {id:'h_halo',icon:'😇',name:'천사 고리',desc:'빛나는 천사 후광',price:140},
            {id:'h_devil',icon:'😈',name:'악마 뿔',desc:'귀여운 악마 뿔',price:140},
            {id:'h_cat',icon:'🐱',name:'고양이 귀',desc:'냥냥 고양이 귀',price:120},
            {id:'h_bunny',icon:'🐰',name:'토끼 귀',desc:'쫑긋 토끼 귀',price:120},
            {id:'h_bear',icon:'🐻',name:'곰 귀',desc:'포근한 곰 귀',price:120},
            {id:'h_fox',icon:'🦊',name:'여우 귀',desc:'영리한 여우 귀',price:125},
            {id:'h_unicorn',icon:'🦄',name:'유니콘 뿔',desc:'마법의 유니콘 뿔',price:160},
            {id:'h_dragon2',icon:'🐉',name:'용 뿔',desc:'전설의 용 뿔',price:180},
            // ── 최고급 모자 (200코인+) ──
            {id:'h_galaxy2',icon:'🌌',name:'은하 왕관',desc:'우주가 담긴 왕관',price:250},
            {id:'h_diamond2',icon:'💎',name:'다이아 왕관',desc:'다이아로 된 왕관',price:300},
            {id:'h_phoenix',icon:'🔶',name:'피닉스 깃털',desc:'불사조 깃털 장식',price:220},
            {id:'h_sakura',icon:'🌺',name:'히비스커스',desc:'열대 꽃 왕관',price:200},
            {id:'h_alien',icon:'👽',name:'외계인 안테나',desc:'삐뽀삐뽀 안테나',price:200},
        ],
        effects:[
            // ── 기본 효과 (60~90코인) ──
            {id:'e_sparkle',icon:'✨',name:'반짝반짝',desc:'별가루 반짝이',price:80},
            {id:'e_heart',icon:'💖',name:'하트 팡팡',desc:'떠다니는 하트',price:70},
            {id:'e_fire',icon:'🔥',name:'불꽃',desc:'뜨거운 불꽃 흔적',price:90},
            {id:'e_bubble',icon:'🫧',name:'비눗방울',desc:'동글동글 비눗방울',price:60},
            {id:'e_leaf',icon:'🍃',name:'나뭇잎',desc:'바람에 날리는 나뭇잎',price:65},
            {id:'e_snow',icon:'🌨️',name:'눈송이',desc:'내리는 하얀 눈',price:70},
            // ── 중급 효과 (90~150코인) ──
            {id:'e_star',icon:'⭐',name:'별똥별',desc:'떨어지는 별똥별',price:100},
            {id:'e_music',icon:'🎵',name:'음표',desc:'흥겨운 음표 파티',price:90},
            {id:'e_lightning',icon:'⚡',name:'전기',desc:'찌릿찌릿 전기 효과',price:110},
            {id:'e_rainbow',icon:'🌈',name:'무지개빛',desc:'무지개색 잔상',price:120},
            {id:'e_petal',icon:'🌸',name:'꽃잎',desc:'흩날리는 벚꽃잎',price:100},
            // ── 고급 효과 (150코인+) ──
            {id:'e_galaxy',icon:'🔮',name:'은하수',desc:'우주 파티클',price:200},
            {id:'e_pixel',icon:'🟩',name:'픽셀붕괴',desc:'픽셀이 흩어지는 효과',price:150},
            {id:'e_ghost',icon:'👻',name:'유령',desc:'투명한 유령 잔상',price:160},
            {id:'e_dragon',icon:'🐉',name:'용의 숨결',desc:'용의 불꽃 아우라',price:250},
        ],
        titles:[
            // ── 기본 칭호 (80~120코인) ──
            {id:'t_ninja',icon:'🥷',name:'그림자 닌자',desc:'은밀하게 출석',price:100,titleText:'그림자 닌자'},
            {id:'t_star',icon:'💫',name:'별에서 온 학생',desc:'우주에서 온 존재',price:100,titleText:'별에서 온 학생'},
            {id:'t_happy',icon:'😊',name:'행복 전도사',desc:'항상 웃는 얼굴',price:80,titleText:'행복 전도사'},
            {id:'t_sleepy',icon:'😴',name:'잠이 최고',desc:'잠만 자고 싶은...',price:80,titleText:'잠이 최고'},
            {id:'t_foodie',icon:'🍕',name:'급식 마스터',desc:'급식이 제일 좋아',price:80,titleText:'급식 마스터'},
            {id:'t_gamer',icon:'🎮',name:'게임의 신',desc:'게임은 나한테 맡겨',price:90,titleText:'게임의 신'},
            {id:'t_artist',icon:'🎨',name:'예술가',desc:'픽셀아트의 달인',price:90,titleText:'예술가'},
            {id:'t_music2',icon:'🎸',name:'음악천재',desc:'리듬을 타는 천재',price:90,titleText:'음악천재'},
            // ── 중급 칭호 (120~180코인) ──
            {id:'t_sun2',icon:'☀️',name:'태양계의 지배자',desc:'태양보다 빛나는',price:150,titleText:'태양계의 지배자'},
            {id:'t_blackhole',icon:'🕳️',name:'블랙홀',desc:'모든 것을 빨아들임',price:150,titleText:'블랙홀'},
            {id:'t_dragon',icon:'🐉',name:'용의 후예',desc:'전설의 용족 후예',price:150,titleText:'용의 후예'},
            {id:'t_wizard',icon:'🧙',name:'마법사',desc:'고대의 마법 사용자',price:140,titleText:'마법사'},
            {id:'t_angel',icon:'😇',name:'천사',desc:'순수한 빛의 존재',price:130,titleText:'천사'},
            {id:'t_demon',icon:'😈',name:'악마',desc:'어둠의 지배자',price:130,titleText:'악마'},
            {id:'t_pirate',icon:'🏴‍☠️',name:'해적왕',desc:'바다의 정복자',price:140,titleText:'해적왕'},
            {id:'t_knight',icon:'⚔️',name:'기사단장',desc:'정의의 검을 휘두르는',price:140,titleText:'기사단장'},
            {id:'t_scientist',icon:'🔬',name:'천재 과학자',desc:'IQ 999의 두뇌',price:130,titleText:'천재 과학자'},
            {id:'t_detective',icon:'🔍',name:'명탐정',desc:'모든 비밀을 파헤치는',price:120,titleText:'명탐정'},
            {id:'t_chef',icon:'👨‍🍳',name:'요리왕',desc:'금손의 요리사',price:120,titleText:'요리왕'},
            {id:'t_athlete',icon:'🏃',name:'체육 만점',desc:'운동신경 만렙',price:120,titleText:'체육 만점'},
            // ── 고급 칭호 (180~250코인) ──
            {id:'t_legend',icon:'🏆',name:'전설의 출석왕',desc:'출석의 전설',price:200,titleText:'전설의 출석왕'},
            {id:'t_emperor',icon:'👑',name:'반장 of 반장',desc:'교실의 진정한 왕',price:200,titleText:'반장 of 반장'},
            {id:'t_phantom',icon:'👤',name:'팬텀',desc:'존재감 없는 존재',price:180,titleText:'팬텀'},
            {id:'t_god',icon:'⚡',name:'전지전능',desc:'모든 것을 아는 자',price:250,titleText:'전지전능'},
            {id:'t_time',icon:'⏰',name:'시간의 지배자',desc:'시간을 멈출 수 있는',price:220,titleText:'시간의 지배자'},
            {id:'t_chaos',icon:'🌀',name:'카오스 메이커',desc:'혼돈을 만드는 자',price:200,titleText:'카오스 메이커'},
            {id:'t_ice',icon:'🧊',name:'얼음 여왕/왕',desc:'냉정한 카리스마',price:180,titleText:'얼음 여왕/왕'},
            {id:'t_flame',icon:'🔥',name:'불꽃 파이터',desc:'열정이 넘치는',price:180,titleText:'불꽃 파이터'},
            // ── 최고급 칭호 (250코인+) ──
            {id:'t_universe',icon:'🌌',name:'우주의 끝',desc:'차원을 넘나드는 존재',price:300,titleText:'우주의 끝'},
            {id:'t_shadow',icon:'🌑',name:'그림자 군주',desc:'어둠 그 자체',price:280,titleText:'그림자 군주'},
            {id:'t_rainbow2',icon:'🌈',name:'무지개 유니콘',desc:'모든 색을 가진 존재',price:280,titleText:'무지개 유니콘'},
            {id:'t_pixel2',icon:'🟩',name:'픽셀의 신',desc:'32x32의 지배자',price:350,titleText:'픽셀의 신'},
        ],
        pets:[
            // ── 기본 동물 (50~80코인) ──
            {id:'p_dog',icon:'🐶',name:'강아지',desc:'충실한 반려견',price:50},
            {id:'p_cat',icon:'🐱',name:'고양이',desc:'도도한 고양이',price:50},
            {id:'p_hamster',icon:'🐹',name:'햄스터',desc:'볼 빵빵 햄스터',price:55},
            {id:'p_rabbit',icon:'🐰',name:'토끼',desc:'깡충깡충 토끼',price:55},
            {id:'p_bird',icon:'🐦',name:'참새',desc:'짹짹짹 참새',price:60},
            {id:'p_turtle',icon:'🐢',name:'거북이',desc:'느긋한 거북이',price:60},
            {id:'p_fish',icon:'🐟',name:'물고기',desc:'둥둥 떠다니는 물고기',price:65},
            {id:'p_bee',icon:'🐝',name:'꿀벌',desc:'윙윙 꿀벌',price:65},
            {id:'p_ladybug',icon:'🐞',name:'무당벌레',desc:'행운의 무당벌레',price:70},
            {id:'p_butterfly',icon:'🦋',name:'나비',desc:'아름다운 나비',price:80},
            // ── 귀여운 동물 (80~120코인) ──
            {id:'p_panda',icon:'🐼',name:'판다',desc:'대나무를 좋아하는',price:80},
            {id:'p_koala',icon:'🐨',name:'코알라',desc:'졸린 코알라',price:85},
            {id:'p_fox',icon:'🦊',name:'여우',desc:'영리한 여우',price:90},
            {id:'p_raccoon',icon:'🦝',name:'너구리',desc:'장난꾸러기 너구리',price:90},
            {id:'p_penguin',icon:'🐧',name:'펭귄',desc:'뒤뚱뒤뚱 펭귄',price:95},
            {id:'p_chick',icon:'🐥',name:'병아리',desc:'삐약삐약 병아리',price:85},
            {id:'p_unicorn',icon:'🦄',name:'유니콘',desc:'무지개 유니콘',price:120},
            {id:'p_pig',icon:'🐷',name:'돼지',desc:'꿀꿀 돼지',price:80},
            {id:'p_frog',icon:'🐸',name:'개구리',desc:'개굴개굴',price:85},
            {id:'p_hedgehog',icon:'🦔',name:'고슴도치',desc:'뾰족뾰족 귀여운',price:100},
            // ── 야생 동물 (120~180코인) ──
            {id:'p_lion',icon:'🦁',name:'사자',desc:'백수의 왕',price:150},
            {id:'p_tiger',icon:'🐯',name:'호랑이',desc:'용맹한 호랑이',price:150},
            {id:'p_bear',icon:'🐻',name:'곰',desc:'거대한 곰',price:130},
            {id:'p_eagle',icon:'🦅',name:'독수리',desc:'하늘의 제왕',price:140},
            {id:'p_wolf',icon:'🐺',name:'늑대',desc:'고독한 늑대',price:145},
            {id:'p_shark',icon:'🦈',name:'상어',desc:'바다의 포식자',price:160},
            {id:'p_croc',icon:'🐊',name:'악어',desc:'무시무시한 악어',price:155},
            {id:'p_elephant',icon:'🐘',name:'코끼리',desc:'거대한 코끼리',price:170},
            {id:'p_flamingo',icon:'🦩',name:'플라밍고',desc:'우아한 플라밍고',price:130},
            {id:'p_parrot',icon:'🦜',name:'앵무새',desc:'말하는 앵무새',price:120},
            // ── 판타지 (180~280코인) ──
            {id:'p_dragon',icon:'🐉',name:'용',desc:'전설의 용',price:280},
            {id:'p_bat',icon:'🦇',name:'박쥐',desc:'어둠의 박쥐',price:180},
            {id:'p_dragon2',icon:'🐲',name:'동양의 용',desc:'신비한 동양 용',price:250},
            {id:'p_scorpion',icon:'🦂',name:'전갈',desc:'독침의 전갈',price:200},
            {id:'p_spider',icon:'🕷️',name:'거미',desc:'거미줄 마스터',price:190},
            {id:'p_octopus',icon:'🐙',name:'문어',desc:'똑똑한 문어',price:210},
            {id:'p_squid',icon:'🦑',name:'오징어',desc:'심해의 오징어',price:200},
            {id:'p_snake',icon:'🐍',name:'뱀',desc:'슬리더링 뱀',price:185},
            {id:'p_lizard',icon:'🦎',name:'도마뱀',desc:'카멜레온 도마뱀',price:190},
            {id:'p_pawprint',icon:'🐾',name:'수수께끼 발자국',desc:'보이지 않는 친구',price:220},
            // ── 전설 (280~400코인) ──
            {id:'p_alien',icon:'👾',name:'외계인',desc:'우주에서 온 친구',price:300},
            {id:'p_robot',icon:'🤖',name:'로봇',desc:'AI 로봇 펫',price:320},
            {id:'p_ufo',icon:'🛸',name:'UFO',desc:'미확인 비행물체',price:350},
            {id:'p_star',icon:'🌟',name:'별',desc:'빛나는 별',price:280},
            {id:'p_skull',icon:'💀',name:'해골',desc:'무서운 해골',price:300},
            {id:'p_ghost',icon:'👻',name:'유령',desc:'떠다니는 유령',price:290},
            {id:'p_pumpkin',icon:'🎃',name:'호박',desc:'할로윈 호박',price:310},
            {id:'p_tooth',icon:'🦷',name:'이빨요정',desc:'이빨을 가져가는',price:280},
            {id:'p_teddy',icon:'🧸',name:'곰인형',desc:'살아 움직이는 인형',price:350},
            {id:'p_matryoshka',icon:'🪆',name:'마트료시카',desc:'러시아 인형',price:400},
        ],
        misc:[
            {id:'r_rename',icon:'✏️',name:'이름변경권',desc:'캐릭터 이름을 1회 변경',price:50,consumable:true},
        ],
    },

    // ── Fitting Room State ──
    fitting: {
        active: false,       // whether an item is being previewed
        idleRunning: false,  // whether idle loop is running
        itemId: null,
        item: null,
        tab: null,
        player: null,
        animRef: null,
        keys: {},
        particles: [],
        platforms: [
            {x:0, y:460, w:400, h:60},   // ground
            {x:20, y:350, w:110, h:16},   // left platform
            {x:150, y:290, w:100, h:16},  // center platform
            {x:280, y:350, w:110, h:16},  // right platform
        ],
        W: 400, H: 520,
        GRAVITY: 0.8, JUMP_FORCE: -14, MOVE_SPD: 4,
    },

    _fittingKeyDown: null,
    _fittingKeyUp: null,

    /** Start the idle fitting room loop (no item selected, just character walking around) */
    startIdleLoop(){
        const f = this.fitting;
        if(f.idleRunning) return;
        f.idleRunning = true;

        const sprite = CharRender.toOffscreen(Player.pixels, 32);
        f.player = { x: f.W/2, y: f.H-160, vx:0, vy:0, dir:1, onGround:false, sprite, w:32, h:48, jumpCount:0 };
        f.particles = [];

        // Key bindings
        f.keys = {};
        this._fittingKeyDown = e => { f.keys[e.key] = true; };
        this._fittingKeyUp = e => { f.keys[e.key] = false; };
        window.addEventListener('keydown', this._fittingKeyDown);
        window.addEventListener('keyup', this._fittingKeyUp);

        const loop = () => {
            if(!f.idleRunning) return;
            this.fittingUpdate();
            this.fittingRender();
            f.animRef = requestAnimationFrame(loop);
        };
        f.animRef = requestAnimationFrame(loop);
    },

    /** Stop the idle fitting room loop */
    stopIdleLoop(){
        const f = this.fitting;
        f.idleRunning = false;
        f.active = false;
        if(f.animRef) cancelAnimationFrame(f.animRef);
        f.animRef = null;
        if(this._fittingKeyDown) window.removeEventListener('keydown', this._fittingKeyDown);
        if(this._fittingKeyUp) window.removeEventListener('keyup', this._fittingKeyUp);
        this._fittingKeyDown = null;
        this._fittingKeyUp = null;
        f.keys = {};
    },

    switchTab(btn,tab){
        this.currentTab=tab;
        document.querySelectorAll('.shop-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        this.clearFittingItem();
        // Toggle color editor vs fitting room
        const ceEl = document.getElementById('color-editor');
        const frEl = document.getElementById('fitting-room');
        if(tab==='colors'){
            ceEl.classList.remove('hidden');
            frEl.classList.add('hidden');
            this.stopIdleLoop();
            this.ceInit();
        } else {
            ceEl.classList.add('hidden');
            frEl.classList.remove('hidden');
            this.ce.active = false;
            if(!this.fitting.idleRunning) this.startIdleLoop();
        }
        // 학생 작품 탭: 승인된 아이템 로드
        if(tab==='student' && Marketplace) Marketplace.loadApproved().then(()=>this.render());
        else this.render();
    },

    /** Clear the currently previewed item but keep idle loop running */
    clearFittingItem(){
        const f = this.fitting;
        f.active = false;
        f.itemId = null;
        f.item = null;
        f.tab = null;
        f.particles = [];
        document.getElementById('fitting-room').classList.remove('active');
        document.getElementById('fitting-info').textContent = '아이템을 선택하세요';
        document.getElementById('fitting-price').textContent = '';
        document.getElementById('fitting-depreciation').textContent = '';
        document.getElementById('fitting-buy').classList.add('hidden');
    },

    render(){
        const g=document.getElementById('shop-grid');g.innerHTML='';document.getElementById('S-coins').textContent=Player.coins;
        // Auto-start idle loop when rendering shop (not for colors tab)
        if(this.currentTab!=='colors' && !this.fitting.idleRunning) this.startIdleLoop();

        // ── 학생 작품 탭 ──
        if(this.currentTab==='student'){
            this._renderStudentTab(g);
            return;
        }

        (this.allItems[this.currentTab]||[]).forEach(item=>{
            const isTitle = this.currentTab==='titles';
            const isConsumable = item.consumable;
            const owned = isConsumable ? false : Player.owned.includes(item.id);
            const ownCount = isConsumable ? Player.owned.filter(x=>x===item.id).length : 0;
            const can = Player.coins>=item.price && !owned;
            const isEq = (this.currentTab==='hats'&&Player.equipped.hat===item.id) ||
                         (this.currentTab==='effects'&&Player.equipped.effect===item.id) ||
                         (this.currentTab==='pets'&&Player.equipped.pet===item.id) ||
                         (isTitle && Player.activeTitle===item.titleText);
            const d=document.createElement('div');d.className='shop-card'+(owned?' owned':'');
            let btnHtml='';
            if(isConsumable){
                btnHtml=`<button class="btn-buy" ${can?'':'disabled'} onclick="Shop.buy('${item.id}',${item.price})">${can?'구매':'코인 부족'}</button>`;
                if(ownCount>0) btnHtml=`<div style="font-size:.72rem;color:var(--green);margin-bottom:.3rem">보유: ${ownCount}장</div>`+btnHtml;
            } else if(this.currentTab==='colors'){
                // Colors tab: trial button + buy
                if(owned){
                    btnHtml=`<div style="font-size:.68rem;color:var(--green)">✅ 팔레트에 추가됨</div>`;
                } else {
                    btnHtml=`<button class="btn-try" ${can?'':'disabled'} onclick="Shop.ceTrialColor('${item.id}')">${can?'🎨 사용해보기':'코인 부족'}</button>`;
                }
            } else if(owned){
                if(isTitle) btnHtml=`<button class="btn-buy" onclick="Shop.equipTitle('${item.titleText}')">${isEq?'해제':'장착'}</button>`;
                else btnHtml=`<button class="btn-buy" onclick="Shop.equip('${item.id}','${this.currentTab}')">${isEq?'해제':'장착'}</button>`;
            } else {
                btnHtml=`<button class="btn-try" ${can?'':'disabled'} onclick="Shop.openFitting('${item.id}','${this.currentTab}')">${can?'착용해보기':'코인 부족'}</button>`;
            }
            const sellPrice = owned && !isConsumable ? Math.floor(item.price * this.DEPRECIATION) : 0;
            const priceText = owned && !isConsumable ? `보유 중 <span style="font-size:.65rem;color:rgba(255,150,150,.6)">(판매가: ${sellPrice})</span>` : '🪙 '+item.price;
            d.innerHTML=`<div class="shop-icon">${esc(item.icon)}</div><div class="shop-name">${esc(item.name)}</div><div style="font-size:.72rem;color:rgba(255,255,255,.4)">${esc(item.desc)}</div><div class="shop-price">${priceText}</div>${btnHtml}`;
            g.appendChild(d);
        });
    },

    // ── 학생 작품 탭 렌더링 ──
    _renderStudentTab(g){
        if(!Marketplace) return;
        const items = Marketplace.approvedItems;

        // 헤더: 내 작품 판매하기 버튼
        const header = document.createElement('div');
        header.style.cssText = 'grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem';
        header.innerHTML = `
            <span style="font-size:.82rem;color:rgba(255,255,255,.5)">${items.length}개의 학생 작품</span>
            <button class="btn sm purple" onclick="Nav.go('marketplace-submit');Marketplace.renderMySubmissions()">🎨 내 작품 판매하기</button>
        `;
        g.appendChild(header);

        if(!items.length){
            const empty = document.createElement('div');
            empty.style.cssText = 'grid-column:1/-1;text-align:center;color:rgba(255,255,255,.3);padding:2rem;font-size:.9rem';
            empty.textContent = '아직 등록된 학생 작품이 없습니다.';
            g.appendChild(empty);
            return;
        }

        items.forEach(item => {
            const owned = Player.owned.includes(item.id);
            const can = Player.coins >= item.price && !owned;
            const isMine = item.creatorId === (window.DB && window.DB.userId);
            const d = document.createElement('div');
            d.className = 'shop-card' + (owned ? ' owned' : '');

            let iconHtml;
            if(item.pixelData){
                const cvs = CharRender.toTinyCanvas(item.pixelData, 48);
                cvs.style.cssText = 'image-rendering:pixelated;border-radius:4px;border:1px solid rgba(255,255,255,.1);width:48px;height:48px;';
                iconHtml = cvs.outerHTML;
            } else {
                iconHtml = `<div class="shop-icon">${item.icon}</div>`;
            }

            let btnHtml;
            if(isMine) btnHtml = `<div style="font-size:.68rem;color:var(--yellow)">내 작품</div>`;
            else if(owned) btnHtml = `<div style="font-size:.68rem;color:var(--green)">✅ 보유 중</div>`;
            else btnHtml = `<button class="btn-buy" ${can?'':'disabled'} onclick="Shop.buyStudentItem('${item.id}')">${can?'구매':'코인 부족'}</button>`;

            d.innerHTML = `${iconHtml}<div class="shop-name">${esc(item.name)}</div><div style="font-size:.72rem;color:rgba(255,255,255,.4)">${esc(item.desc)}</div><div class="shop-creator">by ${esc(item.creator)}</div><div class="shop-price">🪙 ${item.price}</div>${item.salesCount>0?`<div class="shop-sales">${item.salesCount}명 구매</div>`:''}${btnHtml}`;
            g.appendChild(d);
        });
    },

    // ── 학생 아이템 구매 ──
    async buyStudentItem(itemId){
        if(!Marketplace) return;
        if(!confirm('이 아이템을 구매하시겠습니까?')) return;
        const ok = await Marketplace.buyStudentItem(itemId);
        if(ok){ alert('구매 완료!'); this.render(); }
    },

    // ── Fitting Room Methods ──
    openFitting(itemId, tab){
        const item = Object.values(this.allItems).flat().find(i=>i.id===itemId);
        if(!item) return;
        if(Player.coins < item.price) return;
        if(!item.consumable && Player.owned.includes(itemId)) return;

        const f = this.fitting;
        f.active = true;
        f.itemId = itemId;
        f.item = item;
        f.tab = tab;
        f.particles = [];

        // Refresh sprite in case character changed
        f.player.sprite = CharRender.toOffscreen(Player.pixels, 32);

        // Update UI
        const el = document.getElementById('fitting-room');
        el.classList.add('active');
        document.getElementById('fitting-info').textContent = `${item.icon} ${item.name}`;
        document.getElementById('fitting-price').textContent = `🪙 ${item.price} 코인`;
        const sellPrice = Math.floor(item.price * this.DEPRECIATION);
        document.getElementById('fitting-depreciation').textContent = `📉 환불 시 ${sellPrice}코인 (원가의 ${Math.round(this.DEPRECIATION*100)}%)`;
        const buyBtn = document.getElementById('fitting-buy');
        buyBtn.textContent = `🛒 구입 (${item.price}코인)`;
        buyBtn.classList.remove('hidden');
    },

    closeFitting(){
        this.clearFittingItem();
    },

    buyFromFitting(){
        const f = this.fitting;
        if(!f.active || !f.item) return;
        const item = f.item;
        this.buy(item.id, item.price);
        this.clearFittingItem();
    },

    fittingUpdate(){
        const f = this.fitting;
        const p = f.player;
        if(!p) return;

        // Movement
        if(f.keys['ArrowLeft']||f.keys['a']||f.keys['A']){ p.vx = -f.MOVE_SPD; p.dir = -1; }
        else if(f.keys['ArrowRight']||f.keys['d']||f.keys['D']){ p.vx = f.MOVE_SPD; p.dir = 1; }
        else p.vx *= 0.7;
        if(Math.abs(p.vx)<0.2) p.vx=0;

        // Jump
        if((f.keys['ArrowUp']||f.keys['w']||f.keys['W']||f.keys[' ']) && p.onGround){
            p.vy = f.JUMP_FORCE;
            p.onGround = false;
            p.jumpCount = 1;
        }
        // Double jump
        if((f.keys['ArrowUp']||f.keys['w']||f.keys['W']||f.keys[' ']) && !p.onGround && p.jumpCount===1 && p.vy>0){
            p.vy = f.JUMP_FORCE*0.85;
            p.jumpCount = 2;
            f.keys['ArrowUp']=false; f.keys['w']=false; f.keys['W']=false; f.keys[' ']=false;
        }

        // Gravity
        p.vy += f.GRAVITY;
        if(p.vy > 20) p.vy = 20;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if(p.x < -5) p.x = f.W + 5;
        if(p.x > f.W + 5) p.x = -5;

        // Platform collision
        p.onGround = false;
        for(const plat of f.platforms){
            if(p.x+p.w/2 > plat.x && p.x-p.w/2 < plat.x+plat.w){
                if(p.vy >= 0 && p.y+p.h >= plat.y && p.y+p.h <= plat.y+plat.h+p.vy+2){
                    p.y = plat.y - p.h;
                    p.vy = 0;
                    p.onGround = true;
                    p.jumpCount = 0;
                }
            }
        }

        // Effect particles — type-specific spawning
        if(f.tab === 'effects' && Inventory){
            const effId = f.itemId;
            const colors = Inventory.EFFECT_COLORS[effId];
            if(colors){
                const isMoving = Math.abs(p.vx)>0.5;
                const chance = isMoving ? 0.45 : 0.08;
                if(Math.random() < chance){
                    const c = colors[Math.floor(Math.random()*colors.length)];
                    const base = {x:p.x+(Math.random()-.5)*32, y:p.y+p.h/2+Math.random()*20};
                    if(effId==='e_sparkle'){
                        f.particles.push({...base,vx:-p.vx*0.2+(Math.random()-.5)*3,vy:-Math.random()*3-1,color:c,size:16+Math.random()*12,life:30+Math.random()*25,maxLife:55,type:'sparkle'});
                    } else if(effId==='e_heart'){
                        f.particles.push({x:p.x+(Math.random()-.5)*40,y:p.y+Math.random()*20,vx:(Math.random()-.5)*1.5,vy:-Math.random()*3-1,color:c,size:12+Math.random()*10,life:45+Math.random()*25,maxLife:70,type:'heart'});
                    } else if(effId==='e_fire'){
                        f.particles.push({x:p.x+(Math.random()-.5)*28,y:p.y+p.h+Math.random()*10,vx:(Math.random()-.5)*2.4,vy:-Math.random()*5-2,color:c,size:14+Math.random()*10,life:22+Math.random()*18,maxLife:40,type:'fire'});
                    } else if(effId==='e_dragon'){
                        // 용의 숨결: 넓은 범위 + 거대 화염 + 연기
                        for(let i=0;i<2;i++){
                            f.particles.push({x:p.x+(Math.random()-.5)*50,y:p.y+p.h*0.3+Math.random()*30,vx:-p.vx*0.3+(Math.random()-.5)*4,vy:-Math.random()*4-1,color:c,size:18+Math.random()*14,life:28+Math.random()*20,maxLife:48,type:'dragonflame'});
                        }
                        if(Math.random()<0.4) f.particles.push({x:p.x+(Math.random()-.5)*30,y:p.y+p.h*0.5,vx:(Math.random()-.5)*2,vy:-Math.random()*2-1,color:'rgba(80,60,80,0.6)',size:20+Math.random()*10,life:20+Math.random()*15,maxLife:35,type:'smoke'});
                    } else if(effId==='e_bubble'){
                        f.particles.push({...base,vx:(Math.random()-.5)*1.6,vy:-Math.random()*3-.6,color:c,size:14+Math.random()*14,life:45+Math.random()*35,maxLife:80,type:'bubble'});
                    } else if(effId==='e_leaf'||effId==='e_petal'){
                        f.particles.push({...base,vx:(Math.random()-.5)*4,vy:-Math.random()+1,color:c,size:14+Math.random()*10,life:40+Math.random()*30,maxLife:70,type:effId==='e_petal'?'petal':'leaf'});
                    } else if(effId==='e_snow'){
                        f.particles.push({x:p.x+(Math.random()-.5)*60,y:p.y-10,vx:(Math.random()-.5)*1.2,vy:Math.random()*1.6+.6,color:c,size:10+Math.random()*8,life:50+Math.random()*35,maxLife:85,type:'snow'});
                    } else if(effId==='e_star'){
                        f.particles.push({...base,vx:(Math.random()-.5)*5,vy:-Math.random()*6-2,color:c,size:16+Math.random()*10,life:25+Math.random()*20,maxLife:45,type:'sparkle'});
                    } else if(effId==='e_music'){
                        f.particles.push({x:p.x+(Math.random()-.5)*40,y:p.y,vx:(Math.random()-.5)*3,vy:-Math.random()*4-2,color:c,size:18+Math.random()*10,life:35+Math.random()*25,maxLife:60,type:'music'});
                    } else if(effId==='e_lightning'){
                        for(let i=0;i<2;i++) f.particles.push({x:p.x+(Math.random()-.5)*20,y:p.y+Math.random()*40,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,color:c,size:10+Math.random()*8,life:10+Math.random()*12,maxLife:22,type:'lightning'});
                    } else if(effId==='e_rainbow'){
                        // 무지개 리본 — 긴 잔상
                        const t=Date.now()*0.003;
                        for(let i=0;i<3;i++){
                            const ci=colors[i%colors.length];
                            f.particles.push({x:p.x-p.vx*(2+i*1.5),y:p.y+p.h*0.3+i*5,vx:-p.vx*0.12,vy:0,color:ci,size:22+Math.random()*6,life:60+Math.random()*30,maxLife:90,type:'ribbon',phase:t+i*0.8,baseY:p.y+p.h*0.3+i*5});
                        }
                    } else if(effId==='e_galaxy'){
                        // 은하수 리본 — 긴 잔상
                        const t2=Date.now()*0.002;
                        f.particles.push({x:p.x-p.vx*2,y:p.y+p.h*0.2,vx:-p.vx*0.08,vy:0,color:'#0D0D2B',size:26+Math.random()*6,life:70+Math.random()*30,maxLife:100,type:'galaxyribbon',phase:t2,baseY:p.y+p.h*0.2});
                        if(Math.random()<0.5){
                            f.particles.push({x:p.x-p.vx*2+(Math.random()-.5)*24,y:p.y+p.h*0.2+(Math.random()-.5)*14,vx:-p.vx*0.06+(Math.random()-.5),vy:(Math.random()-.5)*0.5,color:'#FFFFFF',size:4+Math.random()*3,life:35+Math.random()*20,maxLife:55,type:'sparkle'});
                        }
                    } else if(effId==='e_pixel'){
                        f.particles.push({...base,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,color:c,size:12+Math.random()*8,life:20+Math.random()*18,maxLife:38,type:'pixel'});
                    } else if(effId==='e_ghost'){
                        f.particles.push({x:p.x+(Math.random()-.5)*40,y:p.y+Math.random()*30,vx:(Math.random()-.5)*1.6,vy:-Math.random()*2-.6,color:c,size:18+Math.random()*14,life:35+Math.random()*25,maxLife:60,type:'ghost'});
                    }
                }
            }
        }
        // Update particles (cap at 80 to prevent lag — ribbon trails need more)
        if(f.particles.length > 80) f.particles.splice(0, f.particles.length - 80);
        f.particles = f.particles.filter(pt => {
            pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.05; pt.life--;
            return pt.life > 0;
        });
    },

    fittingRender(){
        const f = this.fitting;
        const cvs = document.getElementById('fitting-canvas');
        if(!cvs) return;
        const ctx = cvs.getContext('2d');
        const W = f.W, H = f.H;

        // Background gradient
        const grad = ctx.createLinearGradient(0,0,0,H);
        grad.addColorStop(0,'#0c0c24');
        grad.addColorStop(0.6,'#1a1a3e');
        grad.addColorStop(1,'#1a3a4a');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,W,H);

        // Stars
        ctx.fillStyle='rgba(255,255,255,.15)';
        for(let i=0;i<16;i++){
            const sx=(i*67+20)%W, sy=(i*43+10)%(H-80);
            ctx.fillRect(sx,sy,2,2);
        }

        // Platforms
        f.platforms.forEach((p,i) => {
            if(i===0){
                // Ground
                ctx.fillStyle='#4a7c59'; ctx.fillRect(p.x,p.y,p.w,p.h);
                ctx.fillStyle='#6ab04c'; ctx.fillRect(p.x,p.y,p.w,6);
            } else {
                ctx.fillStyle='#795548';
                ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,6);ctx.fill();
                ctx.fillStyle='#8D6E63';
                ctx.fillRect(p.x+2,p.y,p.w-4,6);
            }
        });

        // Effect particles (behind character) — type-specific rendering
        f.particles.forEach(pt => {
            const alpha = pt.maxLife ? pt.life/pt.maxLife : Math.min(1, pt.life/15);
            ctx.globalAlpha = alpha;
            if(pt.type==='heart'){
                // Canvas-drawn heart (no emoji — much faster)
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.save();ctx.translate(pt.x,pt.y);
                ctx.beginPath();
                ctx.moveTo(0,-s*0.4);
                ctx.bezierCurveTo(-s*0.5,-s,  -s,-s*0.4,  0,s*0.5);
                ctx.moveTo(0,-s*0.4);
                ctx.bezierCurveTo(s*0.5,-s,  s,-s*0.4,  0,s*0.5);
                ctx.fill();ctx.restore();
            } else if(pt.type==='sparkle'){
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Date.now()*0.005+pt.x);
                ctx.fillRect(-s/2,-1.5,s,3);ctx.fillRect(-1.5,-s/2,3,s);ctx.restore();
            } else if(pt.type==='fire'){
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='bubble'){
                const s=pt.size*alpha;
                ctx.strokeStyle=pt.color;ctx.lineWidth=2;ctx.globalAlpha=alpha*0.7;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.stroke();
                ctx.globalAlpha=alpha*0.12;ctx.fillStyle=pt.color;ctx.fill();
                // Highlight
                ctx.globalAlpha=alpha*0.5;ctx.fillStyle='#fff';
                ctx.beginPath();ctx.arc(pt.x-s*0.3,pt.y-s*0.3,s*0.2,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='leaf'){
                ctx.fillStyle=pt.color;ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Date.now()*0.003+pt.x);
                ctx.beginPath();ctx.ellipse(0,0,pt.size*alpha,pt.size*alpha*0.45,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(pt.type==='petal'){
                ctx.fillStyle=pt.color;ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Date.now()*0.002+pt.y);
                ctx.beginPath();ctx.ellipse(0,0,pt.size*alpha*0.4,pt.size*alpha,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(pt.type==='snow'){
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();
                // Soft glow
                ctx.globalAlpha=alpha*0.2;ctx.beginPath();ctx.arc(pt.x,pt.y,s*1.8,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='music'){
                // Canvas-drawn note (no emoji — much faster)
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.beginPath();ctx.ellipse(pt.x,pt.y,s*0.45,s*0.35,Math.PI*-0.3,0,Math.PI*2);ctx.fill();
                ctx.strokeStyle=pt.color;ctx.lineWidth=2;
                ctx.beginPath();ctx.moveTo(pt.x+s*0.35,pt.y);ctx.lineTo(pt.x+s*0.35,pt.y-s);ctx.stroke();
                // Flag
                ctx.beginPath();ctx.moveTo(pt.x+s*0.35,pt.y-s);ctx.quadraticCurveTo(pt.x+s*0.8,pt.y-s*0.7,pt.x+s*0.35,pt.y-s*0.5);ctx.fill();
            } else if(pt.type==='lightning'){
                ctx.strokeStyle=pt.color;ctx.lineWidth=3;ctx.globalAlpha=alpha;
                const ls=pt.size;
                ctx.beginPath();ctx.moveTo(pt.x,pt.y);
                ctx.lineTo(pt.x+(Math.random()-.5)*ls*3,pt.y+(Math.random()-.5)*ls*3);ctx.stroke();
                ctx.fillStyle=pt.color;ctx.beginPath();ctx.arc(pt.x,pt.y,ls*0.5,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='ribbon'){
                // Flowing rainbow cloth — sine-wave flutter
                const s=pt.size*alpha;
                const t=Date.now()*0.004;
                const waveY=Math.sin(t+pt.phase)*6;
                ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.75;
                ctx.save();ctx.translate(pt.x,pt.y+waveY);
                ctx.beginPath();
                // Cloth shape: wide flowing curve
                ctx.moveTo(-s*0.6,-3);
                ctx.quadraticCurveTo(-s*0.2, -6+Math.sin(t+pt.phase+1)*4, s*0.2, -2);
                ctx.quadraticCurveTo(s*0.5, 2+Math.sin(t+pt.phase+2)*3, s*0.6, 0);
                ctx.lineTo(s*0.6, 5);
                ctx.quadraticCurveTo(s*0.3, 3+Math.sin(t+pt.phase+1.5)*3, 0, 6);
                ctx.quadraticCurveTo(-s*0.3, 4+Math.sin(t+pt.phase+0.5)*2, -s*0.6, 3);
                ctx.closePath();ctx.fill();
                // Subtle highlight
                ctx.globalAlpha=alpha*0.3;ctx.fillStyle='#FFFFFF';
                ctx.beginPath();ctx.ellipse(0,-1,s*0.2,2,0,0,Math.PI*2);ctx.fill();
                ctx.restore();
            } else if(pt.type==='galaxyribbon'){
                // Dark galaxy cloth with embedded starlight
                const s2=pt.size*alpha;
                const t3=Date.now()*0.003;
                const waveY2=Math.sin(t3+pt.phase)*5;
                ctx.save();ctx.translate(pt.x,pt.y+waveY2);
                // Dark cloth body
                ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.65;
                ctx.beginPath();
                ctx.moveTo(-s2*0.6,-4);
                ctx.quadraticCurveTo(-s2*0.2, -7+Math.sin(t3+pt.phase+1)*5, s2*0.2, -3);
                ctx.quadraticCurveTo(s2*0.5, 1+Math.sin(t3+pt.phase+2)*4, s2*0.7, -1);
                ctx.lineTo(s2*0.7, 5);
                ctx.quadraticCurveTo(s2*0.3, 3+Math.sin(t3+pt.phase+1.5)*3, 0, 7);
                ctx.quadraticCurveTo(-s2*0.3, 5+Math.sin(t3+pt.phase+0.5)*3, -s2*0.6, 4);
                ctx.closePath();ctx.fill();
                // Deep purple glow
                ctx.globalAlpha=alpha*0.3;ctx.fillStyle='#4A0E78';
                ctx.beginPath();ctx.ellipse(0,1,s2*0.35,3.5,0,0,Math.PI*2);ctx.fill();
                // Tiny embedded stars twinkling on cloth
                ctx.globalAlpha=alpha*(0.5+Math.sin(t3*2+pt.phase)*0.3);ctx.fillStyle='#FFFFFF';
                for(let si=0;si<3;si++){
                    const sx=(si-1)*s2*0.3+Math.sin(t3+si*2)*2;
                    const sy=(si%2)*4-2+Math.cos(t3+si*1.5)*1.5;
                    ctx.beginPath();ctx.arc(sx,sy,1+Math.sin(t3*3+si)*0.5,0,Math.PI*2);ctx.fill();
                }
                ctx.restore();
            } else if(pt.type==='dragonflame'){
                // 용의 숨결: 거대한 불꽃 + 내부 밝은 코어
                const s=pt.size*alpha;
                ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.7;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();
                // 밝은 코어
                ctx.globalAlpha=alpha*0.5;ctx.fillStyle='#FFF8E0';
                ctx.beginPath();ctx.arc(pt.x,pt.y,s*0.4,0,Math.PI*2);ctx.fill();
                // 외곽 아우라
                ctx.globalAlpha=alpha*0.15;ctx.fillStyle=pt.color;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s*1.6,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='smoke'){
                const s=pt.size*alpha;
                ctx.fillStyle='#3d3d3d';ctx.globalAlpha=alpha*0.25;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='pixel'){
                ctx.fillStyle=pt.color;const s=Math.ceil(pt.size*alpha);
                ctx.fillRect(Math.floor(pt.x),Math.floor(pt.y),s,s);
            } else if(pt.type==='ghost'){
                ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.35;const s=pt.size*alpha;
                // Ghost body
                ctx.beginPath();ctx.arc(pt.x,pt.y-s*0.3,s,Math.PI,0);
                ctx.lineTo(pt.x+s,pt.y+s*0.5);ctx.lineTo(pt.x+s*0.5,pt.y+s*0.2);
                ctx.lineTo(pt.x,pt.y+s*0.5);ctx.lineTo(pt.x-s*0.5,pt.y+s*0.2);
                ctx.lineTo(pt.x-s,pt.y+s*0.5);ctx.closePath();ctx.fill();
            } else {
                ctx.fillStyle=pt.color;ctx.beginPath();ctx.arc(pt.x,pt.y,pt.size,0,Math.PI*2);ctx.fill();
            }
        });
        ctx.globalAlpha = 1;

        // Character
        const p = f.player;
        if(p && p.sprite){
            ctx.save();
            if(p.dir===-1){ctx.translate(p.x,0);ctx.scale(-1,1);ctx.drawImage(p.sprite,-32,p.y-32,64,64);}
            else ctx.drawImage(p.sprite,p.x-32,p.y-32,64,64);
            ctx.restore();

            // Hat (trial or existing)
            const hatId = f.tab==='hats' ? f.itemId : Player.equipped.hat;
            if(hatId && Inventory && Inventory.HAT_EMOJI[hatId]){
                ctx.save();
                ctx.font='22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText(Inventory.HAT_EMOJI[hatId], p.x, p.y-32);
                ctx.restore();
            }

            // Title (trial or existing)
            const titleText = (f.tab==='titles' && f.item) ? f.item.titleText : Player.activeTitle;
            if(titleText){
                ctx.fillStyle='rgba(162,155,254,.9)';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
                ctx.fillText(titleText, p.x, p.y+p.h+16);
            }

            // Pet (trial or existing)
            const petId = f.tab==='pets' ? f.itemId : Player.equipped.pet;
            if(petId && Inventory && Inventory.PET_EMOJI[petId]){
                const petX = p.x + (p.dir===-1 ? 30 : -30);
                const petBounce = Math.sin(Date.now()*0.004)*3;
                ctx.font='20px sans-serif';ctx.textAlign='center';
                ctx.fillText(Inventory.PET_EMOJI[petId], petX, p.y+p.h-5+petBounce);
            }

            // Player indicator arrow
            const ay = p.y - 48 + Math.sin(Date.now()*0.005)*3;
            ctx.fillStyle='#FDCB6E';ctx.font='16px sans-serif';ctx.textAlign='center';
            ctx.fillText('▼', p.x, ay);

            // Nickname
            if(Player.nickname){
                ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
                ctx.fillText(Player.nickname, p.x, p.y-36);
            }
        }

        // Color preview (for color tab items)
        if(f.tab==='colors' && f.item && f.item.hex){
            ctx.fillStyle=f.item.hex;
            ctx.beginPath();ctx.roundRect(W-52,10,44,44,8);ctx.fill();
            ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=2;
            ctx.beginPath();ctx.roundRect(W-52,10,44,44,8);ctx.stroke();
        }
    },

    // ══════════════════════════════════════
    // COLOR EDITOR (mini pixel editor in shop)
    // ══════════════════════════════════════
    ceInit(){
        const ce = this.ce;
        ce.active = true;
        ce.tool = 'pen';
        ce.color = '#6C5CE7';
        ce.trialColor = null;
        ce.trialId = null;
        ce.pixels = Player.pixels ? Player.pixels.map(r=>[...r]) : Array.from({length:GRID},()=>Array(GRID).fill(null));
        ce.origPixels = ce.pixels.map(r=>[...r]);
        ce.drawing = false;

        const cvs = document.getElementById('color-editor-canvas');
        cvs.width = CANVAS_PX; cvs.height = CANVAS_PX;
        cvs.onpointerdown = e => { ce.drawing=true; this.cePaint(e); };
        cvs.onpointermove = e => { if(ce.drawing) this.cePaint(e); };
        cvs.onpointerup = () => ce.drawing=false;
        cvs.onpointerleave = () => ce.drawing=false;

        this.ceRenderPalette();
        this.ceDraw();
        // Hide buy area
        const buyArea = document.getElementById('ce-buy-area');
        if(buyArea) buyArea.classList.add('hidden');
    },

    cePaint(e){
        const ce = this.ce;
        const cvs = document.getElementById('color-editor-canvas');
        const r = cvs.getBoundingClientRect();
        // Account for object-fit:contain scaling
        const dispW = cvs.clientWidth, dispH = cvs.clientHeight;
        const scale = Math.min(dispW/CANVAS_PX, dispH/CANVAS_PX);
        const offX = (dispW - CANVAS_PX*scale)/2, offY = (dispH - CANVAS_PX*scale)/2;
        const mx = (e.clientX - r.left - offX)/scale, my = (e.clientY - r.top - offY)/scale;
        const x = Math.floor(mx/CELL), y = Math.floor(my/CELL);
        if(x<0||x>=GRID||y<0||y>=GRID) return;
        if(ce.tool==='pen') ce.pixels[y][x] = ce.color;
        else if(ce.tool==='eraser') ce.pixels[y][x] = null;
        else if(ce.tool==='fill') this.ceFlood(x,y,ce.pixels[y][x],ce.color);
        this.ceDraw();
    },

    ceFlood(x,y,target,rep){
        const ce = this.ce;
        if(target===rep||x<0||x>=GRID||y<0||y>=GRID||ce.pixels[y][x]!==target) return;
        ce.pixels[y][x]=rep;
        this.ceFlood(x+1,y,target,rep);this.ceFlood(x-1,y,target,rep);
        this.ceFlood(x,y+1,target,rep);this.ceFlood(x,y-1,target,rep);
    },

    ceDraw(){
        const ce = this.ce;
        const cvs = document.getElementById('color-editor-canvas');
        if(!cvs) return;
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0,0,CANVAS_PX,CANVAS_PX);
        for(let y=0;y<GRID;y++) for(let x=0;x<GRID;x++) if(ce.pixels[y][x]){
            ctx.fillStyle=ce.pixels[y][x]; ctx.fillRect(x*CELL,y*CELL,CELL,CELL);
        }
        // Grid lines
        ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=.5;
        for(let i=0;i<=GRID;i++){ctx.beginPath();ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,CANVAS_PX);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*CELL);ctx.lineTo(CANVAS_PX,i*CELL);ctx.stroke();}
        // Preview
        const p=document.getElementById('ce-preview');
        if(p){p.width=64;p.height=64;const pc=p.getContext('2d');pc.clearRect(0,0,64,64);const s=64/GRID;
        for(let y=0;y<GRID;y++) for(let x=0;x<GRID;x++) if(ce.pixels[y][x]){pc.fillStyle=ce.pixels[y][x];pc.fillRect(Math.floor(x*s),Math.floor(y*s),Math.ceil(s),Math.ceil(s));}}
    },

    ceTool(tool, btn){
        this.ce.tool = tool;
        document.querySelectorAll('.ce-tool').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
    },

    ceRenderPalette(){
        const pal = document.getElementById('ce-palette');
        if(!pal) return;
        pal.innerHTML = '';
        const ce = this.ce;
        // Owned shop colors
        const owned = this.allItems.colors.filter(c=>Player.owned.includes(c.id)).map(c=>c.hex);
        const all = [...this.defaultPalette, ...owned];
        // Trial color first (if any)
        if(ce.trialColor && !all.includes(ce.trialColor)){
            const s = document.createElement('div');
            s.className = 'pal-swatch trial' + (ce.trialColor===ce.color?' active':'');
            s.style.background = ce.trialColor;
            s.title = '시험용 색상';
            s.onclick = () => { ce.color=ce.trialColor; this.ceRenderPalette(); };
            pal.appendChild(s);
        }
        all.forEach(h => {
            const s = document.createElement('div');
            s.className = 'pal-swatch' + (h===ce.color?' active':'');
            s.style.background = h;
            s.onclick = () => { ce.color=h; this.ceRenderPalette(); };
            pal.appendChild(s);
        });
    },

    /** Called when user clicks a color item in the shop grid while on colors tab */
    ceTrialColor(itemId){
        const item = this.allItems.colors.find(c=>c.id===itemId);
        if(!item) return;
        const ce = this.ce;
        ce.trialColor = item.hex;
        ce.trialId = itemId;
        ce.color = item.hex;
        this.ceRenderPalette();
        // Show buy area
        const area = document.getElementById('ce-buy-area');
        area.classList.remove('hidden');
        document.getElementById('ce-buy-info').textContent = `${item.icon} ${item.name}`;
        document.getElementById('ce-buy-price').textContent = `🪙 ${item.price}`;
        const btn = document.getElementById('ce-buy-btn');
        btn.textContent = `🛒 구입 (${item.price}코인)`;
        btn.disabled = Player.coins < item.price;
    },

    ceBuy(){
        const ce = this.ce;
        if(!ce.trialId) return;
        const item = this.allItems.colors.find(c=>c.id===ce.trialId);
        if(!item || Player.coins < item.price || Player.owned.includes(item.id)) return;
        this.buy(item.id, item.price);
        // Color now owned — move from trial to palette
        ce.trialColor = null;
        ce.trialId = null;
        document.getElementById('ce-buy-area').classList.add('hidden');
        this.ceRenderPalette();
    },

    ceSave(){
        Player.pixels = this.ce.pixels.map(r=>[...r]);
        Player.save();
        // Refresh sprite if fitting room is active
        if(this.fitting.player) this.fitting.player.sprite = CharRender.toOffscreen(Player.pixels, 32);
    },

    ceReset(){
        this.ce.pixels = this.ce.origPixels.map(r=>[...r]);
        this.ceDraw();
    },

    buy(id,p){
        if(Player.coins<p)return;
        const item = Object.values(this.allItems).flat().find(i=>i.id===id);
        if(!item) return;
        if(!item.consumable && Player.owned.includes(id)) return;
        Player.addCoins(-p, 'purchase');
        Player.owned.push(id);
        if(item.titleText) Player.titles.push(item.titleText);
        Player.save(); this.render();
    },
    equip(id,tab){const k=tab==='hats'?'hat':tab==='pets'?'pet':'effect';Player.equipped[k]=Player.equipped[k]===id?null:id;Player.save();this.render();},
    equipTitle(titleText){
        Player.activeTitle = Player.activeTitle===titleText ? null : titleText;
        Player.save(); Player.refreshUI(); this.render();
    },
    useReward(id){
        const idx = Player.owned.indexOf(id);
        if(idx===-1)return false;
        Player.owned.splice(idx,1);
        Player.save(); this.render();
        return true;
    }
};
