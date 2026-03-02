/**
 * 게임 내 커스텀 한글 키보드 (모바일 전용)
 * - 네이티브 키보드 대신 가로 모드에서 사용
 * - 자모 조합 지원 (초성+중성+종성)
 * - 터치 기기에서만 활성화
 */

// ── 한글 자모 데이터 ──
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 겹받침 조합 테이블: {종성+자음 → 겹받침}
const DOUBLE_JONG = {
    'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ','ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ',
    'ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ','ㅂㅅ':'ㅄ'
};

// 겹받침 분리 테이블: {겹받침 → [첫째, 둘째]}
const SPLIT_JONG = {};
Object.entries(DOUBLE_JONG).forEach(([k,v]) => { SPLIT_JONG[v] = [k[0], k[1]]; });

// 겹모음 조합 테이블: {모음+모음 → 겹모음}
const DOUBLE_JUNG = {
    'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ'
};

// 겹모음 분리 테이블
const SPLIT_JUNG = {};
Object.entries(DOUBLE_JUNG).forEach(([k,v]) => { SPLIT_JUNG[v] = [k[0], k[1]]; });

function isCho(c) { return CHO.includes(c); }
function isJung(c) { return JUNG.includes(c); }

// 한글 음절 조합
function compose(cho, jung, jong) {
    const ci = CHO.indexOf(cho);
    const ji = JUNG.indexOf(jung);
    const ki = jong ? JONG.indexOf(jong) : 0;
    if(ci < 0 || ji < 0 || ki < 0) return null;
    return String.fromCharCode(0xAC00 + ci * 21 * 28 + ji * 28 + ki);
}

// 한글 음절 분해
function decompose(ch) {
    const code = ch.charCodeAt(0);
    if(code < 0xAC00 || code > 0xD7A3) return null;
    const offset = code - 0xAC00;
    const jong = offset % 28;
    const jung = ((offset - jong) / 28) % 21;
    const cho = ((offset - jong) / 28 - jung) / 21;
    return { cho: CHO[cho], jung: JUNG[jung], jong: JONG[jong] };
}

export const GameKeyboard = {
    _visible: false,
    _text: '',
    _composing: [],  // 조합 중인 자모 배열: [{type:'cho'|'jung'|'jong', char}]
    _shifted: false,
    _onSubmit: null,
    _el: null,
    _displayEl: null,

    init() {
        this._el = document.getElementById('game-keyboard');
        this._displayEl = document.getElementById('gk-display');
        if(!this._el) return;
        this._buildKeys();
    },

    // ── 키보드 표시/숨기기 ──
    show(onSubmit) {
        if(!this._el) this.init();
        if(!this._el) return;
        this._onSubmit = onSubmit;
        this._text = '';
        this._composing = [];
        this._shifted = false;
        this._updateDisplay();
        this._el.classList.remove('hidden');
        this._visible = true;
        this._updateShiftVisual();
    },

    hide() {
        if(!this._el) return;
        this._el.classList.add('hidden');
        this._visible = false;
        this._text = '';
        this._composing = [];
    },

    isVisible() { return this._visible; },

    // ── 키 레이아웃 빌드 ──
    _buildKeys() {
        const rows = [
            ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],
            ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],
            ['SHIFT','ㅋ','ㅌ','ㅊ','ㅍ','ㅜ','ㅡ','⌫'],
            ['ENG','SPACE','↵']
        ];
        // 쌍자음/쌍모음 (shift 상태)
        this._shiftMap = {
            'ㅂ':'ㅃ','ㅈ':'ㅉ','ㄷ':'ㄸ','ㄱ':'ㄲ','ㅅ':'ㅆ',
            'ㅐ':'ㅒ','ㅔ':'ㅖ'
        };
        // 영어 키 레이아웃
        this._engRows = [
            ['q','w','e','r','t','y','u','i','o','p'],
            ['a','s','d','f','g','h','j','k','l'],
            ['SHIFT','z','x','c','v','b','n','m','⌫'],
            ['한','SPACE','↵']
        ];
        this._engMode = false;
        this._korRows = rows;
        this._renderKeys(rows);
    },

    _renderKeys(rows) {
        const container = this._el.querySelector('.gk-keys');
        if(!container) return;
        container.innerHTML = '';
        rows.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'gk-row';
            row.forEach(key => {
                const btn = document.createElement('button');
                btn.className = 'gk-key';
                btn.dataset.key = key;
                if(key === 'SPACE') { btn.textContent = ' '; btn.classList.add('gk-space'); }
                else if(key === '⌫') { btn.textContent = '⌫'; btn.classList.add('gk-special'); }
                else if(key === 'SHIFT') { btn.textContent = '⇧'; btn.classList.add('gk-special','gk-shift'); }
                else if(key === '↵') { btn.textContent = '보내기'; btn.classList.add('gk-special','gk-enter'); }
                else if(key === 'ENG') { btn.textContent = 'EN'; btn.classList.add('gk-special','gk-lang'); }
                else if(key === '한') { btn.textContent = '한'; btn.classList.add('gk-special','gk-lang'); }
                else { btn.textContent = key; }
                // 터치 이벤트
                btn.onpointerdown = (e) => { e.preventDefault(); this._onKey(key); };
                rowEl.appendChild(btn);
            });
            container.appendChild(rowEl);
        });
    },

    _onKey(key) {
        if(key === 'SHIFT') {
            this._shifted = !this._shifted;
            this._updateShiftVisual();
            return;
        }
        if(key === 'ENG') {
            this._engMode = true;
            this._flushComposing();
            this._renderKeys(this._engRows);
            this._updateShiftVisual();
            return;
        }
        if(key === '한') {
            this._engMode = false;
            this._renderKeys(this._korRows);
            this._updateShiftVisual();
            return;
        }
        if(key === '⌫') {
            this._backspace();
            this._updateDisplay();
            return;
        }
        if(key === 'SPACE') {
            this._flushComposing();
            this._text += ' ';
            this._updateDisplay();
            return;
        }
        if(key === '↵') {
            this._flushComposing();
            const text = this._text.trim();
            if(text && this._onSubmit) this._onSubmit(text);
            this._text = '';
            this._composing = [];
            this._updateDisplay();
            this.hide();
            return;
        }

        // 글자수 제한
        if(this._text.length + 1 > 30) return;

        if(this._engMode) {
            // 영어 모드
            const ch = this._shifted ? key.toUpperCase() : key;
            this._text += ch;
            if(this._shifted) { this._shifted = false; this._updateShiftVisual(); }
            this._updateDisplay();
            return;
        }

        // 한글 모드: shift 적용
        let ch = key;
        if(this._shifted && this._shiftMap[key]) {
            ch = this._shiftMap[key];
        }
        if(this._shifted) { this._shifted = false; this._updateShiftVisual(); }

        this._inputJamo(ch);
        this._updateDisplay();
    },

    // ── 한글 자모 입력 핵심 로직 ──
    _inputJamo(ch) {
        const comp = this._composing;

        // 비어있으면 새 조합 시작
        if(comp.length === 0) {
            if(isCho(ch)) {
                comp.push({type:'cho', char:ch});
            } else if(isJung(ch)) {
                // 모음만 단독 입력
                comp.push({type:'jung', char:ch});
            }
            return;
        }

        const last = comp[comp.length - 1];

        // 초성만 있는 상태
        if(comp.length === 1 && last.type === 'cho') {
            if(isJung(ch)) {
                // 초성 + 중성
                comp.push({type:'jung', char:ch});
            } else if(isCho(ch)) {
                // 다른 초성 → 현재 조합 확정, 새로 시작
                this._flushComposing();
                comp.push({type:'cho', char:ch});
            }
            return;
        }

        // 모음만 있는 상태
        if(comp.length === 1 && last.type === 'jung') {
            if(isJung(ch)) {
                // 겹모음 시도
                const dbl = DOUBLE_JUNG[last.char + ch];
                if(dbl) {
                    last.char = dbl;
                } else {
                    this._flushComposing();
                    comp.push({type:'jung', char:ch});
                }
            } else if(isCho(ch)) {
                this._flushComposing();
                comp.push({type:'cho', char:ch});
            }
            return;
        }

        // 초성 + 중성 있는 상태
        if(comp.length === 2 && comp[0].type === 'cho' && comp[1].type === 'jung') {
            if(isCho(ch)) {
                // 종성으로 추가
                if(JONG.includes(ch)) {
                    comp.push({type:'jong', char:ch});
                } else {
                    this._flushComposing();
                    comp.push({type:'cho', char:ch});
                }
            } else if(isJung(ch)) {
                // 겹모음 시도
                const dbl = DOUBLE_JUNG[comp[1].char + ch];
                if(dbl) {
                    comp[1].char = dbl;
                } else {
                    // 새 모음 → 현재 확정, 새로 시작
                    this._flushComposing();
                    comp.push({type:'jung', char:ch});
                }
            }
            return;
        }

        // 초성 + 중성 + 종성 있는 상태
        if(comp.length === 3 && comp[2].type === 'jong') {
            if(isJung(ch)) {
                // 종성을 떼어서 다음 초성으로
                const jongChar = comp[2].char;
                // 겹받침이면 분리
                if(SPLIT_JONG[jongChar]) {
                    const [first, second] = SPLIT_JONG[jongChar];
                    comp[2].char = first;
                    this._flushComposing();
                    comp.push({type:'cho', char:second});
                    comp.push({type:'jung', char:ch});
                } else {
                    comp.pop(); // 종성 제거
                    this._flushComposing();
                    comp.push({type:'cho', char:jongChar});
                    comp.push({type:'jung', char:ch});
                }
            } else if(isCho(ch)) {
                // 겹받침 시도
                const dbl = DOUBLE_JONG[comp[2].char + ch];
                if(dbl) {
                    comp[2].char = dbl;
                } else {
                    // 현재 확정, 새로 시작
                    this._flushComposing();
                    comp.push({type:'cho', char:ch});
                }
            }
            return;
        }

        // 예외: 그냥 확정하고 새로 시작
        this._flushComposing();
        if(isCho(ch)) comp.push({type:'cho', char:ch});
        else if(isJung(ch)) comp.push({type:'jung', char:ch});
    },

    // ── 조합 중인 자모를 완성 글자로 확정 ──
    _flushComposing() {
        const comp = this._composing;
        if(comp.length === 0) return;

        if(comp.length === 1) {
            this._text += comp[0].char;
        } else if(comp.length === 2 && comp[0].type === 'cho' && comp[1].type === 'jung') {
            this._text += compose(comp[0].char, comp[1].char, null) || (comp[0].char + comp[1].char);
        } else if(comp.length === 3 && comp[0].type === 'cho' && comp[1].type === 'jung' && comp[2].type === 'jong') {
            this._text += compose(comp[0].char, comp[1].char, comp[2].char) || (comp[0].char + comp[1].char + comp[2].char);
        } else {
            // 예외: 그냥 자모 나열
            comp.forEach(c => { this._text += c.char; });
        }
        this._composing = comp.length = 0;
        this._composing = [];
    },

    // ── 백스페이스 ──
    _backspace() {
        if(this._composing.length > 0) {
            const last = this._composing[this._composing.length - 1];
            // 겹모음/겹받침 분리
            if(last.type === 'jung' && SPLIT_JUNG[last.char]) {
                last.char = SPLIT_JUNG[last.char][0];
            } else if(last.type === 'jong' && SPLIT_JONG[last.char]) {
                last.char = SPLIT_JONG[last.char][0];
            } else {
                this._composing.pop();
            }
        } else if(this._text.length > 0) {
            // 마지막 글자가 완성 한글이면 분해해서 조합 상태로
            const lastCh = this._text[this._text.length - 1];
            const dec = decompose(lastCh);
            if(dec) {
                this._text = this._text.slice(0, -1);
                this._composing = [{type:'cho', char:dec.cho}, {type:'jung', char:dec.jung}];
                if(dec.jong) this._composing.push({type:'jong', char:dec.jong});
                // 마지막 자모 하나 제거
                this._backspace();
            } else {
                this._text = this._text.slice(0, -1);
            }
        }
    },

    // ── 조합 중 문자 포함 현재 텍스트 ──
    getCurrentText() {
        let preview = this._text;
        const comp = this._composing;
        if(comp.length === 1) {
            preview += comp[0].char;
        } else if(comp.length === 2 && comp[0].type === 'cho' && comp[1].type === 'jung') {
            preview += compose(comp[0].char, comp[1].char, null) || (comp[0].char + comp[1].char);
        } else if(comp.length === 3) {
            preview += compose(comp[0].char, comp[1].char, comp[2].char) || (comp[0].char + comp[1].char + comp[2].char);
        }
        return preview;
    },

    _updateDisplay() {
        if(!this._displayEl) return;
        const text = this.getCurrentText();
        this._displayEl.textContent = text || '';
        this._displayEl.dataset.empty = text ? '' : 'true';
    },

    _updateShiftVisual() {
        const shiftBtns = this._el?.querySelectorAll('.gk-shift');
        shiftBtns?.forEach(b => {
            if(this._shifted) b.classList.add('active');
            else b.classList.remove('active');
        });
    }
};
