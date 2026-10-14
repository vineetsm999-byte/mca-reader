/* Chhote helpers jo saare parsers aur analysis use karte hain. Sab kuch window.MCA mein rehta hai. */
(function () {
  const MCA = (window.MCA = window.MCA || {});
  MCA.AMT_RE = /^-?\$?[\d,]*\.\d\d-?$/;
  MCA.DATE_MD = /^(\d{1,2})\/(\d{1,2})$/;
  // '$1,234.56' / '-$12.00' / '1,234.56-' sab ko signed number bana deta hai
  MCA.money = (s) => {
    s = String(s).trim();
    const neg = s.startsWith("-") || s.endsWith("-");
    const v = parseFloat(s.replace(/[$,\-]/g, ""));
    return neg ? -v : v;
  };
  MCA.iso = (y, m, d) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  MCA.textOf = (ws) => ws.map((w) => w.text).join(" ");
  MCA.r2 = (x) => Math.round(x * 100) / 100;
  // words ko lines mein jodta hai (top ke hisaab se, 2.5pt tolerance). Return: [{top, words:[...x se sorted]}]
  MCA.linesOf = (words, yTol = 2.5) => {
    const ws = words.slice().sort((a, b) => a.top - b.top || a.x0 - b.x0);
    const lines = [];
    for (const w of ws) {
      const L = lines[lines.length - 1];
      if (L && Math.abs(w.top - L.top) <= yTol) L.words.push(w);
      else lines.push({ top: w.top, words: [w] });
    }
    lines.forEach((l) => l.words.sort((a, b) => a.x0 - b.x0));
    return lines;
  };
  MCA.pageText = (page) => MCA.linesOf(page.words).map((l) => MCA.textOf(l.words)).join("\n");
  // date helpers (ISO string 'YYYY-MM-DD')
  const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  MCA.dayDiff = (a, b) => Math.round((ms(a) - ms(b)) / 86400000); // a - b
  MCA.addDays = (s, n) => new Date(ms(s) + n * 86400000).toISOString().slice(0, 10);
  MCA.weekday = (s) => new Date(ms(s)).getUTCDay(); // 0=Sun
  MCA.monthLabel = (s) => ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+s.slice(5, 7) - 1] + " " + s.slice(0, 4);
  MCA.median = (a) => {
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
  };
  // Bank parsers ka registry
  MCA.BANKS = MCA.BANKS || [];
  MCA.registerBank = (b) => {
    MCA.BANKS = MCA.BANKS.filter((x) => x.name !== b.name);
    MCA.BANKS.push(b);
    MCA.BANKS.sort((a, b2) => (b2.priority || 0) - (a.priority || 0));
  };
  MCA.identify = (pages) => {
    const text = pages[0] ? MCA.pageText(pages[0]) : "";
    for (const b of MCA.BANKS) {
      try { if (b.detect(text, pages)) return b; } catch (e) { console.error(e); }
    }
    return null;
  };
})();
