export const OTP = {
    code: '', timer: null, remaining: 15,
    chars: '0123456789',
    generate() {
        this.code = '';
        for(let i=0; i<4; i++) this.code += this.chars[Math.floor(Math.random()*this.chars.length)];
        return this.code;
    },
    start() {
        this.generate();
        this.remaining = 15;
        this.updateDisplay();
        clearInterval(this.timer);
        this.timer = setInterval(()=>{
            this.remaining--;
            if(this.remaining <= 0) { this.generate(); this.remaining = 15; }
            this.updateDisplay();
        }, 1000);
    },
    stop() { clearInterval(this.timer); },
    updateDisplay() {
        const codeEl = document.getElementById('otp-code');
        const timerEl = document.getElementById('otp-timer');
        const barEl = document.getElementById('otp-bar');
        if(codeEl) codeEl.textContent = this.code;
        if(timerEl) timerEl.textContent = this.remaining + '초';
        if(barEl) barEl.style.width = (this.remaining/15*100) + '%';
    },
    verify(input) {
        return input === this.code;
    }
};
