/* Wells Fargo Business Checking (Initiate / Navigate ...) monthly PDF */
(function () {
  const { money, iso, linesOf, textOf } = MCA;
  const NAME = "Wells Fargo Business Checking";
  const AMT = /^[\d,]*\.\d\d$/, DATE = /^(\d{1,2})\/(\d{1,2})$/;

  function parse(pages) {
    const t0 = MCA.pageText(pages[0]);
    const year = +t0.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December) \d+, (\d{4})/)[1];
    const t1 = MCA.pageText(pages[1]);
    const g = (lab) => money(t1.match(new RegExp(lab + "[^\\n]*?\\$?\\s*-?\\s*\\$?([\\d,]+\\.\\d\\d)"))[1]);
    const begin = g("Beginning balance on \\d+/\\d+"), credits = g("Deposits/Credits"), debits = g("Withdrawals/Debits"), endBal = g("Ending balance on \\d+/\\d+");
    const bm = t1.match(/Beginning balance on (\d+)\/(\d+)/), em = t1.match(/Ending balance on (\d+)\/(\d+)/);
    const start = iso(year, +bm[1], +bm[2]), end = iso(year, +em[1], +em[2]);
    const acc = t1.match(/Account number:\s*(\d+)/); const account = acc ? acc[1].slice(-4) : "";
    let client = "";
    for (const l of linesOf(pages[0].words)) {
      const left = l.words.filter((w) => w.x0 < 300), t = textOf(left);
      if (l.top > 150 && left.length && t === t.toUpperCase() && /[A-Z]{3}/.test(t) && !t.includes("WELLS")) { client = t.trim(); break; }
    }
    let avg = null;
    for (const p of pages) {
      const m = MCA.pageText(p).match(/Average ledger balance\s+\$[\d,]+\.\d\d\s+\$([\d,]+\.\d\d)/);
      if (m) avg = money(m[1]);
    }
    const txns = [], daily = {}; let done = false;
    for (const page of pages.slice(1)) {
      if (done) break;
      const blocks = []; let cur = null;
      for (const l of linesOf(page.words)) {
        let line = l.words; const first = line[0];
        if (first.text === "Totals" && first.x0 < 100) { done = true; break; }
        if (first.x0 < 95 && DATE.test(first.text)) { cur = { date: first.text, words: [] }; blocks.push(cur); line = line.slice(1); }
        if (!cur) continue;
        cur.words.push(...line);
      }
      for (const b of blocks) {
        const desc = []; let cr = null, dr = null, bal = null;
        for (const w of b.words) {
          if (AMT.test(w.text) && w.x1 > 400) {
            if (w.x1 < 450) cr = money(w.text); else if (w.x1 < 525) dr = money(w.text); else bal = money(w.text);
          } else if (w.text === "<" && w.x0 < 250) continue;
          else desc.push(w.text);
        }
        const m = b.date.match(DATE), d = iso(year, +m[1], +m[2]);
        txns.push({ date: d, desc: desc.join(" "), amount: (cr || 0) - (dr || 0), ref: "", section: "" });
        if (bal !== null) daily[d] = bal;
      }
    }
    return { bank: NAME, client, account, period_start: start, period_end: end, partial: false, begin, end: endBal,
      stated_credits: credits, stated_debits: debits, unparsed_debits: 0, stated_avg_ledger: avg, daily, txns };
  }
  MCA.registerBank({ name: NAME, priority: 10, detect: (t) => { const x = t.toLowerCase(); return x.includes("wells fargo") && x.includes("business"); }, parse });
})();
