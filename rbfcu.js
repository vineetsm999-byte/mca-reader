/* RBFCU (Randolph-Brooks FCU) Business Checking monthly PDF statement */
(function () {
  const { money, iso, linesOf, textOf } = MCA;
  const NAME = "RBFCU Business Checking";
  const AMT = /^-?\$[\d,]+\.\d\d$/, DT = /^\d\d\/\d\d$/;

  function parse(pages) {
    const p1 = MCA.pageText(pages[0]);
    const per = p1.match(/(\d\d)\/(\d\d)\/(\d{4}) through (\d\d)\/(\d\d)\/(\d{4})/);
    const [sm, sd, sy, em, ed, ey] = per.slice(1).map(Number);
    const start = iso(sy, sm, sd), end = iso(ey, em, ed);
    const yrOf = (mo) => (sy === ey || mo >= sm ? sy : ey);
    const nums = [...p1.matchAll(/\$([\d,]+\.\d\d)/g)].map((m) => money("$" + m[1]));
    const [prev, credits, debits, endBal] = nums;
    const acc = p1.match(/SUMMARY \| (\d+)/); const account = acc ? acc[1] : "";
    // client: address block (x 100..200, y 130..260) ki pehli line
    const blk = pages[0].words.filter((w) => w.x0 >= 100 && w.x0 <= 200 && w.top >= 130 && w.top <= 260).sort((a, b) => a.top - b.top || a.x0 - b.x0);
    let client = "";
    if (blk.length) { const t0 = blk[0].top; client = blk.filter((w) => Math.abs(w.top - t0) <= 2.5).map((w) => w.text).join(" "); }
    const txns = [], checks = []; let section = null;
    for (const page of pages) {
      const all = linesOf(page.words);
      if (!all.length) continue;
      const hdrs = [];
      for (const l of all) {
        const tx = textOf(l.words);
        if (tx.startsWith("Checking Account Deposits")) hdrs.push([l.top, "dep"]);
        else if (tx.startsWith("Freedom Check Card") || tx.startsWith("Checking Account Withdrawals")) hdrs.push([l.top, "deb"]);
        else if (tx.startsWith("Checks Cleared")) hdrs.push([l.top, "chk"]);
        else if (tx.startsWith("Other Information")) hdrs.push([l.top, "none"]);
      }
      const secAt = (y) => { for (let i = hdrs.length - 1; i >= 0; i--) if (hdrs[i][0] < y) return hdrs[i][1]; return section; };
      [[0, 310], [310, 1000]].forEach(([x0, x1], col) => {
        let cur = null;
        for (const l of linesOf(page.words.filter((w) => w.x0 >= x0 && w.x0 < x1))) {
          for (const w of l.words) {
            const s = secAt(l.top);
            if (s !== "dep" && s !== "deb") continue;
            if (DT.test(w.text) && w.x0 < (col === 0 ? 60 : 345)) { cur = { date: w.text, desc: [], amt: null, sec: s }; txns.push(cur); continue; }
            if (!cur || cur.sec !== s) continue;
            if (AMT.test(w.text) && cur.amt === null && w.x1 > (col === 0 ? 240 : 500)) { cur.amt = money(w.text); continue; }
            if (["Date", "Description", "Amount"].includes(w.text) || w.text.startsWith("PAGE")) continue;
            cur.desc.push(w.text);
          }
        }
      });
      if (hdrs.length) section = hdrs[hdrs.length - 1][1];
      for (const l of all) {
        if (secAt(l.top) !== "chk") continue;
        const toks = l.words.map((w) => w.text);
        for (let i = 0; i + 2 < toks.length;) {
          if (/^\d+$/.test(toks[i]) && AMT.test(toks[i + 1]) && DT.test(toks[i + 2])) { checks.push([toks[i], money(toks[i + 1]), toks[i + 2]]); i += 3; } else i++;
        }
      }
    }
    const out = [];
    for (const t of txns) {
      if (t.amt === null) continue;
      const mo = +t.date.slice(0, 2), dy = +t.date.slice(3);
      out.push({ date: iso(yrOf(mo), mo, dy), desc: t.desc.join(" ").trim(), amount: t.amt, ref: "", section: t.sec === "dep" ? "Deposits" : "Card & other transactions" });
    }
    for (const [no, amt, d] of checks) {
      const mo = +d.slice(0, 2), dy = +d.slice(3);
      out.push({ date: iso(yrOf(mo), mo, dy), desc: "Check " + no, amount: amt, ref: "", section: "Checks" });
    }
    // statement mein daily balance nahi hota: running balance se din ka closing banate hain
    const by = {}; out.forEach((t) => { by[t.date] = (by[t.date] || 0) + t.amount; });
    const daily = {}; let run = prev;
    Object.keys(by).sort().forEach((d) => { run += by[d]; daily[d] = MCA.r2(run); });
    return { bank: NAME, client, account, period_start: start, period_end: end, partial: false, begin: prev, end: endBal,
      stated_credits: credits, stated_debits: debits, unparsed_debits: 0, stated_avg_ledger: null, daily, daily_computed: true, txns: out };
  }
  MCA.registerBank({ name: NAME, priority: 10, detect: (t) => { const x = t.toLowerCase(); return x.includes("rbfcu") && x.includes("statement period"); }, parse });
})();
