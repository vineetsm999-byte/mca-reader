/* RBFCU online banking se print kiya hua 'Deposit Account' activity (month-to-date) */
(function () {
  const { money, iso } = MCA;
  const NAME = "RBFCU online activity (MTD)";
  const AMT = /^-?\$[\d,]+\.\d\d$/;
  const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

  function parse(pages) {
    const t0 = MCA.pageText(pages[0]);
    const my = t0.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}),/);
    const year = my ? 2000 + +my[3] : new Date().getFullYear();
    const acc = t0.match(/Account\s+(\d+)/); const account = acc ? acc[1] : "";
    let client = "";
    const tl = t0.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = 1; i < tl.length; i++) if (/^Account \d+/.test(tl[i])) { client = tl[i - 1]; break; }

    const rows = []; let curDate = null, pendMonth = null;
    pages.forEach((page, pi) => {
      const ws = page.words.filter((w) => w.top > 40 && w.top < 765);
      const left = ws.filter((w) => w.x0 < 100).sort((a, b) => a.top - b.top);
      const labels = [];
      for (let i = 0; i < left.length; i++) {
        const w = left[i];
        if (MONTHS[w.text]) {
          const day = left.slice(i + 1).find((x) => /^\d+$/.test(x.text) && x.top - w.top > 0 && x.top - w.top <= 28);
          if (day) labels.push([w.top, MONTHS[w.text], +day.text]); else pendMonth = MONTHS[w.text];
        } else if (/^\d+$/.test(w.text) && w.top < 140) {
          const prevHasMonth = left.some((x) => MONTHS[x.text] && w.top - x.top > 0 && w.top - x.top <= 28);
          if (!prevHasMonth && pendMonth) { curDate = [pendMonth, +w.text]; pendMonth = null; }
        }
      }
      const amts = ws.filter((w) => w.x0 >= 400 && w.x0 <= 456 && AMT.test(w.text));
      const bals = ws.filter((w) => w.x0 >= 500 && w.x0 <= 525 && AMT.test(w.text));
      const descWords = ws.filter((w) => w.x0 >= 160 && w.x0 < 400);
      const events = [...labels.map((l) => [l[0], "L", l]), ...amts.map((a) => [a.top, "R", a])].sort((a, b) => a[0] - b[0]);
      const pr = [];
      for (const [top, kind, obj] of events) {
        if (kind === "L") { curDate = [obj[1], obj[2]]; continue; }
        const bal = bals.find((b) => Math.abs(b.top - obj.top) <= 3);
        if (!bal || !curDate) continue;
        const r = { amountW: obj, bal: money(bal.text), date: curDate, lines: [], cls: null };
        rows.push(r); pr.push(r);
      }
      // description lines ko amount rows se jodo
      const dl = descWords.slice().sort((a, b) => a.top - b.top || a.x0 - b.x0);
      const dlines = [];
      for (const w of dl) {
        const L = dlines[dlines.length - 1];
        if (L && Math.abs(w.top - L.top) <= 3) L.words.push(w); else dlines.push({ top: w.top, words: [w], done: false });
      }
      dlines.forEach((ln) => { ln.x0 = Math.min(...ln.words.map((w) => w.x0)); });
      for (const ln of dlines) {
        let near = null, nd = 1e9;
        for (const r of pr) { const d = Math.abs(r.amountW.top - ln.top); if (d < nd) { nd = d; near = r; } }
        if (near && nd <= 3) { near.lines.push(ln); if (near.cls === null) near.cls = ln.x0; ln.done = true; }
      }
      for (const ln of dlines) {
        if (ln.done) continue;
        let best = null, bs = 1e9;
        for (const r of pr) {
          const dy = Math.abs(r.amountW.top - ln.top); if (dy > 20) continue;
          const sc = dy + (r.cls === null || Math.abs(r.cls - ln.x0) < 6 ? 0 : 10);
          if (sc < bs) { best = r; bs = sc; }
        }
        if (best) best.lines.push(ln);
      }
    });
    let txns = rows.map((r) => {
      const ws = r.lines.slice().sort((a, b) => a.top - b.top).flatMap((l) => l.words);
      return { date: iso(year, r.date[0], r.date[1]), desc: ws.map((w) => w.text).join(" ").replace(/ \.\.\./g, "...").trim(),
        amount: money(r.amountW.text), ref: "", section: "Online activity", balance: r.bal };
    });
    if (!txns.length) throw new Error("Is PDF mein transactions nahi mile");
    // page toot-ne se gum hui description: same amount 3+ baar aaya ho to wahi description
    const cnt = {}, firstDesc = {};
    txns.forEach((t) => { if (t.desc) { cnt[t.amount] = (cnt[t.amount] || 0) + 1; if (!(t.amount in firstDesc)) firstDesc[t.amount] = t.desc; } });
    txns.forEach((t) => { if (!t.desc && (cnt[t.amount] || 0) >= 3 && !(t.amount > 0)) t.desc = firstDesc[t.amount] + " (desc guess)"; });
    const last = txns.map((t) => t.date).sort().pop();
    const monthStart = last.slice(0, 8) + "01";
    const inMonth = txns.filter((t) => t.date >= monthStart);
    const lastRowBal = inMonth[0].balance;
    const net = MCA.r2(inMonth.reduce((a, t) => a + t.amount, 0));
    const begin = MCA.r2(lastRowBal - net);
    const topBal = {};
    inMonth.forEach((t) => { if (!(t.date in topBal)) topBal[t.date] = t.balance; });
    const daily = {}; let prev = begin;
    for (let d = monthStart; d <= last; d = MCA.addDays(d, 1)) {
      const wd = MCA.weekday(d);
      if (wd >= 1 && wd <= 5 && d in topBal) prev = topBal[d];
      daily[d] = prev;
    }
    daily[last] = lastRowBal;
    inMonth.forEach((t) => delete t.balance);
    inMonth.reverse();
    return { bank: NAME, client, account, period_start: monthStart, period_end: last, partial: true, begin, end: daily[last],
      stated_credits: null, stated_debits: null, unparsed_debits: 0, stated_avg_ledger: null, daily, txns: inMonth };
  }
  MCA.registerBank({ name: NAME, priority: 20, detect: (t) => t.includes("RBFCU - Deposit Account") || (t.includes("Courtesy Pay") && t.includes("Posted") && t.includes("Available Balance")), parse });
})();
