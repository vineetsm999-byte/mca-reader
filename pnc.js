/* PNC Business Checking (monthly PDF statement) */
(function () {
  const { money, iso, linesOf, textOf, DATE_MD, AMT_RE } = MCA;
  const NAME = "PNC Business Checking";
  const SECTIONS = {
    "Deposits": "Deposits", "ATM Deposits and Additions": "ATM/Card credits", "ACH Additions": "ACH Additions", "Other Additions": "Other Additions",
    "Debit Card Purchases": "Debit Card Purchases", "POS Purchases": "POS Purchases", "ATM/Misc. Debit Card Transactions": "ATM/Misc. Debit Card",
    "ACH Deductions": "ACH Deductions", "Service Charges and Fees": "Service Charges and Fees", "Other Deductions": "Other Deductions",
  };
  const CREDIT = new Set(["Deposits", "ATM Deposits and Additions", "ACH Additions", "Other Additions"]);

  function parse(pages) {
    const p0 = linesOf(pages[0].words);
    const t0 = p0.map((l) => textOf(l.words)).join("\n");
    const per = t0.match(/For the Period (\d\d)\/(\d\d)\/(\d{4}) to (\d\d)\/(\d\d)\/(\d{4})/);
    const [sm, sd, sy, em, ed, ey] = per.slice(1).map(Number);
    const start = iso(sy, sm, sd), end = iso(ey, em, ed);
    const acct = t0.match(/XX-XXXX-(\d+)/); const account = acct ? acct[1] : "";
    // summary numbers
    const amtLines = [];
    for (const l of p0) {
      const toks = l.words.map((w) => w.text);
      if (toks.length && toks.every((t) => /^[\d,]+\.\d\d-?$/.test(t))) amtLines.push(toks.map(money));
    }
    const bal = amtLines.find((l) => l.length === 4);
    const [begin, statedCr, statedDb, endBal] = bal;
    const avgL = amtLines.find((l) => l.length === 2); const avg = avgL ? avgL[0] : null;
    let checksSum = 0;
    for (const l of p0) {
      const tx = l.words.filter((w) => w.x0 >= 305).map((w) => w.text);
      if (tx.length >= 3 && tx[0] === "Checks" && /^\d+$/.test(tx[1]) && /^[\d,]+\.\d\d$/.test(tx[2])) checksSum = money(tx[2]);
    }
    // daily balances
    const daily = {}; let inDaily = false;
    for (const l of p0) {
      if (textOf(l.words).startsWith("Daily Balance")) { inDaily = true; continue; }
      if (!inDaily) continue;
      const toks = l.words.map((w) => w.text);
      for (let i = 0; i < toks.length - 1;) {
        const m = toks[i].match(DATE_MD);
        if (m && /^[\d,]+\.\d\d-?$/.test(toks[i + 1])) {
          const mo = +m[1], dy = +m[2], yr = sy === ey || mo >= sm ? sy : ey;
          daily[iso(yr, mo, dy)] = money(toks[i + 1]); i += 2;
        } else i++;
      }
    }
    // client name
    let client = "";
    if (pages.length > 1) {
      const L = linesOf(pages[1].words);
      for (let i = 1; i < L.length; i++) {
        if (textOf(L[i].words).includes("Primary Account Number")) { client = textOf(L[i - 1].words.filter((w) => w.x0 >= 330)).trim(); break; }
      }
    }
    // transactions
    const txns = []; let section = null, cur = null;
    for (const page of pages.slice(1)) {
      for (const l of linesOf(page.words)) {
        if (l.top < 118) continue;
        const ws = l.words, txt = textOf(ws), base = txt.replace(/\s*-\s*continued$/, ""), first = ws[0];
        if (first.x0 < 80) {
          if (base.startsWith("Checks and Substitute Checks")) { section = "CHECKS"; cur = null; continue; }
          if (SECTIONS[base]) { section = base; cur = null; continue; }
          if (base.startsWith("Detail of Services Used")) { section = null; cur = null; continue; }
        }
        if (!SECTIONS[section]) continue;
        if (first.x0 < 80 && DATE_MD.test(first.text) && ws.length > 1 && AMT_RE.test(ws[1].text) && ws[1].x1 < 215) {
          const m = first.text.match(DATE_MD), mo = +m[1], dy = +m[2], yr = sy === ey || mo >= sm ? sy : ey;
          const rest = ws.slice(2);
          const ref = textOf(rest.filter((w) => w.x0 >= 440)).replace(/ /g, "");
          const desc = textOf(rest.filter((w) => w.x0 < 440));
          const amt = money(ws[1].text);
          cur = { date: iso(yr, mo, dy), desc, ref, amount: CREDIT.has(section) ? amt : -amt, section: SECTIONS[section] };
          txns.push(cur);
        } else if (cur && first.x0 >= 185) {
          if (/^(Transaction|description|Reference|number|Amount|Date|posted)\b/.test(txt)) continue;
          cur.desc += " " + textOf(ws.filter((w) => w.x0 < 440));
        }
      }
    }
    return { bank: NAME, client, account, period_start: start, period_end: end, partial: false, begin, end: endBal,
      stated_credits: statedCr, stated_debits: statedDb, unparsed_debits: checksSum, stated_avg_ledger: avg, daily, txns };
  }
  MCA.registerBank({ name: NAME, priority: 10, detect: (t) => t.includes("PNC") && t.includes("For the Period"), parse });
})();
