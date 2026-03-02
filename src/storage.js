export const LS = {
    get(k, d = null) { try { const v = localStorage.getItem('ck_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { localStorage.setItem('ck_' + k, JSON.stringify(v)); }
};
