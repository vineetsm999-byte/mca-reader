/* MCA analysis engine (browser). Input: normalized statements + lender list. Output: report. */
(function () {
  const MCA = window.MCA, { r2, median, dayDiff, addDays, monthLabel } = MCA;
  const MULT = { Daily: 22, "Twice weekly": 8.4, Weekly: 4.2, "Bi-weekly": 2.1, Monthly: 1 };
  const PERWEEK = { Daily: 5, "Twice weekly": 2, Weekly: 1, "Bi-weekly": 0.5, Monthly: 12 / 52 };
  const EXP_GAP = { Daily: 7, "Twice weekly": 8, Weekly: 11, "Bi-weekly": 18, Monthly: 40 };

  const TRANSFER_RX = /\btfr\b|transfer|txfr|xfer|internet trf|eb from check|apple cash|cash app|overdraft xfer/i;
  const MOBILE_RX = /mobile deposit|atm.*deposit|remote deposit|edeposit|descriptive deposit|atm check/i;
  const ZELLE_RX = /^zel(le)?\b/i;
  const CARD_RX = /real time payment|bankcard dep|clover|stripe|square inc|from square/i;
  const WIRE_IN_RX = /incoming wire|^wt seq|instant pmt from|wire in/i;
  const WIRE_OUT_RX = /assist wire|^wt seq|outgoing wire|wire to/i;
  const REVERSE_RX = /^reverse|^returned|reversal/i;
  const NSF_RX = /returned item fee|overdraft item fee|courtesy pay fee|nsf/i;
  const KEYWORD_RX = /fund|capital|advance|servicing|holding|financ|lending|funding/i;

  function freqOf(dates) {
    const ds = [...new Set(dates)].sort();
    const gaps = []; for (let i = 0; i < ds.length - 1; i++) gaps.push(dayDiff(ds[i + 1], ds[i]));
    if (!gaps.length) return "?";
    const g = median(gaps);
    if (g <= 2) return "Daily"; if (g <= 4) return "Twice weekly"; if (g <= 10) return "Weekly"; if (g <= 18) return "Bi-weekly"; return "Monthly";
  }
  function normKey(desc) {
    let d = desc.toLowerCase();
    d = d.replace(/business to business ach debit -|corporate ach|ach w\/d|ach debit|ach web[- ]?(recur)?|\bach\b|pos w\/d|withdrawal|payments?|pymt|pmt|paymen|epayment|\bdebit\b/g, " ");
    d = d.replace(/[^a-z ]/g, " ");
    return d.split(/\s+/).filter((w) => w.length > 2).slice(0, 3).join(" ");
  }
  function calendarSeries(st) {
    const daily = st.daily || {}; let last = st.begin;
    if (last === null || last === undefined) { const k = Object.keys(daily).sort(); last = k.length ? daily[k[0]] : 0; }
    const out = [];
    for (let d = st.period_start; d <= st.period_end; d = addDays(d, 1)) { if (d in daily) last = daily[d]; out.push([d, r2(last)]); }
    return out;
  }
  const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);

  function analyzeAccount(statements, lenders, settings) {
    settings = settings || MCA.DEFAULT_SETTINGS;
    const CL = lenders.map((L) => { try { return [L, new RegExp(L.pattern, "i")]; } catch (e) { return null; } }).filter(Boolean);
    let sts = statements.slice().sort((a, b) => (a.period_start < b.period_start ? -1 : 1));
    sts = sts.filter((s) => !(s.partial && sts.some((o) => !o.partial && o.period_start <= s.period_start && o.period_end >= s.period_end)));
    const first = sts[0];
    sts.forEach((s, i) => {
      if (s.partial && i > 0 && sts[i - 1].end !== null && sts[i - 1].end !== undefined && dayDiff(s.period_start, sts[i - 1].period_end) <= 2) s.begin = sts[i - 1].end;
    });
    const dataStart = sts[0].period_start, dataEnd = sts[sts.length - 1].period_end;

    const txns = [];
    sts.forEach((s, mi) => s.txns.forEach((t) => {
      const x = Object.assign({}, t); x.mi = mi; x.abs = Math.abs(x.amount); x.side = x.amount > 0 ? "credit" : "debit";
      x.lender = null; x.kind = null; x.returned = false;
      for (const [L, rx] of CL) if (rx.test(x.desc)) { x.lender = L.name; x.kind = L.kind; break; }
      txns.push(x);
    }));
    const lenderCfg = {}; lenders.forEach((L) => (lenderCfg[L.name] = L));

    // bounced / reverse credits
    const returned = [];
    for (const c of txns) {
      if (c.side === "credit" && REVERSE_RX.test(c.desc)) {
        const cand = txns.filter((d) => d.side === "debit" && !d.returned && Math.abs(d.abs - c.abs) < 0.005 &&
          ((c.ref && d.ref === c.ref) || (!c.ref && dayDiff(c.date, d.date) >= 0 && dayDiff(c.date, d.date) <= 6)));
        cand.sort((a, b) => (a.ref !== c.ref) - (b.ref !== c.ref) || Math.abs(dayDiff(c.date, a.date)) - Math.abs(dayDiff(c.date, b.date)));
        if (cand.length) {
          const d = cand[0]; d.returned = true; c.is_reversal = true;
          returned.push({ debit_date: d.date, reversal_date: c.date, amount: d.abs, desc: d.desc.slice(0, 60), lender: d.lender });
        }
      }
    }

    // months
    const months = sts.map((s, mi) => {
      const ser = calendarSeries(s);
      const adb = sum(ser, (x) => x[1]) / ser.length;
      const tx = txns.filter((t) => t.mi === mi), cr = tx.filter((t) => t.side === "credit");
      let left = cr.slice(); const bd = [];
      const take = (label, fn) => { const hit = left.filter(fn); bd.push([label, r2(sum(hit, (t) => t.abs))]); left = left.filter((t) => !hit.includes(t)); return bd[bd.length - 1][1]; };
      const funding = take("MCA funding (naam se pehchane)", (t) => (t.kind === "MCA" || t.kind === "REVERSE") && !t.is_reversal);
      const rev = take("Reverse / bounced debit wapas", (t) => !!t.is_reversal || REVERSE_RX.test(t.desc));
      const loan = take("Loan credits (MCA nahi)", (t) => t.kind === "LOAN" || t.kind === "REVIEW");
      const tr = take("Transfers (apne account / owner / overdraft)", (t) => TRANSFER_RX.test(t.desc) && !CARD_RX.test(t.desc));
      const wires = take("Wires in", (t) => WIRE_IN_RX.test(t.desc));
      const mob = take("Mobile / ATM / remote deposits", (t) => MOBILE_RX.test(t.desc));
      take("Zelle", (t) => ZELLE_RX.test(t.desc));
      take("Card processing (Square RTP, Bankcard, Clover)", (t) => CARD_RX.test(t.desc));
      take("Baaki credits (deposit, vendor, insurance ...)", () => true);
      const parsedCr = r2(sum(cr, (t) => t.abs));
      const parsedDb = r2(sum(tx.filter((t) => t.side === "debit"), (t) => t.abs) + (s.unparsed_debits || 0));
      const sc = s.stated_credits, sd = s.stated_debits;
      const recon = { credits_ok: sc == null ? null : Math.abs(sc - parsedCr) < 0.02, debits_ok: sd == null ? null : Math.abs(sd - parsedDb) < 0.02,
        parsed_credits: parsedCr, parsed_debits: parsedDb, stated_credits: sc, stated_debits: sd };
      const odn = cr.filter((t) => /overdraft xfer/i.test(t.desc)).length;
      const lab = monthLabel(s.period_end);
      return { month: s.partial ? lab.split(" ")[0] + " " + lab.split(" ")[1] + " (MTD)" : lab, start: s.period_start, end: s.period_end, partial: !!s.partial,
        begin: s.begin, end_bal: s.end, total_credits: sc != null ? sc : parsedCr, total_debits: sd != null ? sd : parsedDb,
        adb: r2(adb), adb_approx: !!(s.partial || s.daily_computed), bank_avg: s.stated_avg_ledger == null ? null : s.stated_avg_ledger,
        funding, transfers: r2(rev + loan + tr), transfers_sub: `Reverse/bounce ${rev.toLocaleString("en-US", { minimumFractionDigits: 2 })} + loan credits ${loan.toLocaleString("en-US", { minimumFractionDigits: 2 })} + transfers ${tr.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        breakdown: bd, fee_nsf: tx.filter((t) => NSF_RX.test(t.desc) && t.side === "debit").length, fee_od: odn,
        min_bal: Math.min(...ser.map((x) => x[1])), series: ser, atm: mob, wires, mca_debits: 0, recon, bank: s.bank };
    });

    // positions
    const paysBy = {}, advBy = {};
    for (const t of txns) if (t.kind === "MCA" || t.kind === "REVERSE") ((t.side === "debit" ? paysBy : advBy)[t.lender] = (t.side === "debit" ? paysBy : advBy)[t.lender] || []).push(t);
    const winsAll = txns.filter((t) => t.side === "credit" && WIRE_IN_RX.test(t.desc) && t.kind !== "MCA" && t.kind !== "REVERSE");
    const positions = [];
    const names = [...new Set([...Object.keys(paysBy), ...Object.keys(advBy)])];
    for (const n of names) {
      const cfg = lenderCfg[n];
      const allp = (paysBy[n] || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const good = allp.filter((t) => !t.returned);
      const advs = (advBy[n] || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
      const p = { lender: n, kind: cfg.kind, src: cfg.src || "keyword", note: cfg.note || "", hidden_repay: !!cfg.hidden_repay };
      let streams = [];
      if (good.length) {
        const byAmt = {};
        good.forEach((t) => { const k = r2(t.abs).toFixed(2); (byAmt[k] = byAmt[k] || []).push(t.date); });
        for (const k of Object.keys(byAmt)) {
          const ds = byAmt[k];
          streams.push({ amount: +k, count: ds.length, freq: new Set(ds).size > 1 ? freqOf(ds) : "?", first: ds.slice().sort()[0], last: ds.slice().sort().pop() });
        }
        streams.sort((a, b) => b.count - a.count || b.amount - a.amount);
      }
      const major = streams.filter((s) => s.count >= 3), forced = cfg.forced_freq;
      let freq, emi, monthly, smallRef;
      if (good.length && major.length) {
        if (forced) major.forEach((s) => (s.freq = forced));
        if (major.length === 1) { emi = major[0].amount; freq = major[0].freq; }
        else { emi = r2(sum(major, (s) => s.amount * (PERWEEK[s.freq] || 1))); freq = "Mixed (weekly equiv.)"; }
        monthly = r2(sum(major, (s) => s.amount * (MULT[s.freq] || 1)));
        smallRef = Math.min(...major.map((s) => s.amount));
      } else if (good.length) {
        freq = forced || freqOf(good.map((t) => t.date)); emi = good[good.length - 1].abs; monthly = r2(emi * (MULT[freq] || 1)); smallRef = emi;
      } else { freq = "?"; emi = null; monthly = 0; smallRef = null; }
      Object.assign(p, { freq, emi, monthly, streams: streams.slice(0, 6), small: smallRef });
      if (good.length) {
        const last = good[good.length - 1];
        Object.assign(p, { first: good[0].date, last: last.date, last_amt: last.abs, count: good.length, total: r2(sum(good, (t) => t.abs)) });
        const exp = EXP_GAP[freq] || 11;
        const ending = (smallRef && last.abs < 0.5 * smallRef) || dayDiff(dataEnd, last.date) > exp;
        p.status = ending ? "Ending / closed" : "Active";
      } else Object.assign(p, { first: null, last: null, last_amt: null, count: 0, total: 0, status: "Debit nahi dikha" });
      if (p.hidden_repay) p.status = "Unknown (repayment sales se katta hai)";
      p.pays = allp.map((t) => { const m = t.desc.match(/payment (\d+)/i); return { d: t.date, a: t.abs, r: t.returned, n: m ? +m[1] : null }; });
      const pn = p.pays.filter((x) => x.n !== null).map((x) => x.n);
      p.pno = pn.length ? [Math.min(...pn), Math.max(...pn)] : null;
      const missed = [];
      if (good.length && major.length && freq !== "Monthly") {
        const md = [...new Set(good.filter((t) => r2(t.abs) === major[0].amount).map((t) => t.date))].sort();
        const gaps = []; for (let i = 0; i < md.length - 1; i++) gaps.push(dayDiff(md[i + 1], md[i]));
        const med = gaps.length ? median(gaps) : 0;
        const rets = allp.filter((t) => t.returned).map((t) => t.date);
        const lim = major[0].freq === "Daily" ? 6 : Math.max(10, 1.5 * med);
        gaps.forEach((g, i) => { if (g >= lim && !rets.some((r) => md[i] <= r && r <= md[i + 1])) missed.push({ from: md[i], to: md[i + 1], days: g }); });
      }
      p.missed = missed;
      p.adv = advs.map((a) => ({ date: a.date, amount: a.abs, desc: a.desc.slice(0, 70) }));
      p.adv_total = r2(sum(advs, (a) => a.abs));
      const amts = advs.map((a) => a.abs), reversePat = amts.length >= 3 && Math.max(...amts) - Math.min(...amts) <= 0.01 * Math.max(...amts);
      p.adv_rows = advs.map((a, ai) => {
        const before = good.filter((t) => t.date < a.date), after = good.filter((t) => t.date > a.date);
        const eb = before.length ? before[before.length - 1].abs : null, ea = after.length ? after[0].abs : null;
        let typ, conf;
        if (cfg.kind === "REVERSE" || reversePat) { typ = "Reverse (draft): same advance baar baar, EMI same"; conf = "draft"; }
        else if (p.hidden_repay && advs.length >= 2 && ai > 0) { typ = "Re-up / Refinance? (repayment bank mein dikhta nahi)"; conf = "review"; }
        else if (major.length > 1) { typ = "Check karo (kai EMI streams hain)"; conf = "review"; }
        else if (eb === null) { typ = "Pehla advance dikha, pehle koi EMI nahi (New ya Add-on? friend decide)"; conf = "review"; }
        else if (ea && ea > eb * 1.05) { typ = "Refinance (EMI badhi)"; conf = "draft"; }
        else if (ea && ea > eb) { typ = "Refinance? (EMI thodi badhi)"; conf = "review"; }
        else if (ea && Math.abs(ea - eb) < 0.005) { typ = "EMI same: Reverse? (frequency check karo)"; conf = "review"; }
        else { typ = "Unclear"; conf = "review"; }
        return { date: a.date, amount: a.abs, emi_before: eb, emi_after: ea, type: typ, conf };
      });
      p.type_draft = cfg.kind === "REVERSE" || reversePat ? "Reverse (draft)" : null;
      p.wire_candidates = [];
      if (good.length && !advs.length && dayDiff(p.first, dataStart) > 10) {
        const c = winsAll.filter((w) => dayDiff(p.first, w.date) >= 0 && dayDiff(p.first, w.date) <= 7).sort((a, b) => b.abs - a.abs);
        p.wire_candidates = c.slice(0, 3).map((w) => ({ date: w.date, amount: w.abs, desc: w.desc.slice(0, 70) }));
      }
      positions.push(p);
    }
    positions.sort((a, b) => (b.monthly || 0) - (a.monthly || 0));
    months.forEach((m) => { m.mca_debits = r2(sum(positions.flatMap((p) => p.pays.filter((x) => m.start <= x.d && x.d <= m.end && !x.r)), (x) => x.a)); });

    // tool-format rows
    const toolRows = [];
    for (const p of positions) {
      if (p.adv.length) p.adv_rows.forEach((a) => toolRows.push({ month: monthLabel(a.date).split(" ")[0], start: a.date, lender: p.lender, funded: a.amount, status: p.status, freq: p.freq,
        repay: a.emi_after && p.streams.length <= 1 ? a.emi_after : p.emi, last: p.last, monthly: p.monthly, type: a.type }));
      else toolRows.push({ month: "-", start: null, lender: p.lender, funded: null, status: p.status, freq: p.freq, repay: p.emi, last: p.last, monthly: p.monthly, type: p.type_draft || "" });
    }

    // loan / review card
    const byl = {};
    txns.forEach((t) => { if (t.side === "debit" && (t.kind === "LOAN" || t.kind === "REVIEW")) (byl[t.lender] = byl[t.lender] || []).push(t); });
    const loans = Object.keys(byl).map((n) => {
      const ts = byl[n], ds = ts.map((t) => t.date);
      return { name: n, kind: lenderCfg[n].kind, count: ts.length, freq: new Set(ds).size > 1 ? freqOf(ds) : "ek baar",
        amounts: [...new Set(ts.map((t) => r2(t.abs)))].sort((a, b) => a - b), first: ds.slice().sort()[0], last: ds.slice().sort().pop(), total: r2(sum(ts, (t) => t.abs)) };
    }).sort((a, b) => (a.kind !== "REVIEW") - (b.kind !== "REVIEW") || b.total - a.total);

    // unknown recurring debits
    const grp = {};
    txns.forEach((t) => {
      if (t.side !== "debit" || t.kind !== null || t.returned) return;
      if (!/\bach\b|business to business|epay|payment|pmt|autopay|billing|pymt/i.test(t.desc)) return;
      const k = normKey(t.desc); if (!k) return;
      const key = k + "|" + r2(t.abs).toFixed(2); (grp[key] = grp[key] || []).push(t);
    });
    let unknown = [];
    for (const key of Object.keys(grp)) {
      const ts = grp[key], a = +key.split("|")[1];
      if (ts.length >= (settings.unknown_min_count || 3) && a >= (settings.unknown_min_amount || 100)) {
        const ds = ts.map((t) => t.date), fr = freqOf(ds); if (fr === "?") continue;
        unknown.push({ key: key.split("|")[0], sample: ts[0].desc.slice(0, 70), amount: a, count: ts.length, freq: fr, first: ds.slice().sort()[0], last: ds.slice().sort().pop(), total: r2(a * ts.length), keyword: KEYWORD_RX.test(ts[0].desc) });
      }
    }
    unknown.sort((a, b) => (!a.keyword - !b.keyword) || b.total - a.total); unknown = unknown.slice(0, 15);

    // wires
    const wIn = txns.filter((t) => t.side === "credit" && WIRE_IN_RX.test(t.desc)).map((t) => ({ date: t.date, amount: t.abs, desc: t.desc.slice(0, 90), month: months[t.mi].month, named: t.kind === "MCA" || t.kind === "REVERSE", lender: t.lender }));
    const wOut = txns.filter((t) => t.side === "debit" && WIRE_OUT_RX.test(t.desc) && !/svc charge|fee/i.test(t.desc)).map((t) => ({ date: t.date, amount: t.abs, desc: t.desc.slice(0, 90), month: months[t.mi].month }));

    // flags
    const flags = []; const F = (c, t, s) => flags.push({ c, t, s });
    const $ = (x) => "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    months.forEach((m) => { const r = m.recon; if (r.credits_ok === false || r.debits_ok === false) F("bad", `${m.month}: parse ka total bank se match nahi hua`, `Parse: credits ${$(r.parsed_credits)}, debits ${$(r.parsed_debits)}. Bank: credits ${r.stated_credits}, debits ${r.stated_debits}. Is statement ke numbers par bharosa mat karo, PDF ko haath se dekho.`); });
    months.forEach((m) => { if (m.partial) F("info", `${m.month}: mahina adhura hai`, `${m.start} se ${m.end} tak ka online-banking print hai. Avg Daily Balance approx hai (weekend ka balance pichle din se liya).`); });
    positions.forEach((p) => { if (p.type_draft && p.adv_rows.length) F("warn", `${p.lender}: Reverse MCA lag raha hai (draft)`, `${p.adv_rows.length} advances: ` + p.adv_rows.slice(0, 6).map((x) => `${x.date.slice(5)} ${$(x.amount)}`).join(", ") + ". Advance baar baar same amount ka aaya aur EMI same hai. Notes ke Reverse Lending rule se match. Friend final tag decide kare."); });
    positions.forEach((p) => { const rf = p.adv_rows.filter((r) => r.type.includes("Refinance")); if (rf.length) F("warn", `${p.lender}: Refinance jaisa`, "Advance ke baad EMI badhi: " + rf.map((r) => `${r.date.slice(5)} ${$(r.amount)} (EMI ${r.emi_before ? $(r.emi_before) : "-"} → ${r.emi_after ? $(r.emi_after) : "-"})`).join("; ") + ". Thodi badhi ho to fee bhi ho sakti hai, friend confirm kare."); });
    if (returned.length) F("bad", `${returned.length} debits bounce hue (reverse)`, returned.slice(0, 8).map((r) => `${r.debit_date.slice(5)} ${$(r.amount)} ${r.desc.slice(0, 26)}`).join(" · ") + ". Inhe payment nahi ginna aur reverse credit ko funding/deposit mat ginna.");
    positions.forEach((p) => { if (p.missed.length) F("warn", `${p.lender}: payment skip dikhi`, p.missed.slice(0, 4).map((m) => `${m.from.slice(5)} se ${m.to.slice(5)} (${m.days} din)`).join(", ")); });
    const ended = positions.filter((p) => p.status.startsWith("Ending"));
    if (ended.length) F("warn", "Ye MCAs band hote dikh rahe hain", ended.map((p) => `${p.lender} (last ${p.last.slice(5)}, ${$(p.last_amt)})`).join(", ") + ". Pay-off ke baad kisi naye advance ka refinance to nahi, check karo.");
    const cand = positions.filter((p) => p.wire_candidates.length);
    if (cand.length) F("info", "Funding sender-naam ke bina aayi lag rahi hai", cand.map((p) => p.lender).join(", ") + ". Pehle payment se 7 din pehle ke wires candidate ke taur par MCA card mein diye hain, Wires tab mein bhi dekho.");
    const nm = positions.filter((p) => p.src !== "notes").map((p) => p.lender);
    if (nm.length) F("warn", "Ye lenders tere notes ki list mein nahi the", nm.join(", ") + ". Naam mein Fund/Capital/Advance wagairah hai aur payment repeat hoti hai, isliye MCA maane. Friend confirm kare (Lender list tab mein hai).");
    const hid = positions.filter((p) => p.hidden_repay).map((p) => p.lender);
    if (hid.length) F("warn", "Repayment bank mein alag nahi dikhta", hid.join(", ") + ": sales/deposits se katta hai. Advance dates dikhti hain par EMI aur status pakka nahi.");
    const rv = loans.filter((l) => l.kind === "REVIEW").map((l) => l.name);
    if (rv.length) F("warn", "In par friend ka faisla chahiye (MCA ya nahi)", rv.join(", ") + ". 'Loan jaise' card mein 'MCA hai' dabao to lender list mein jud jaayega.");
    if (unknown.length) F("warn", `${unknown.length} repeat hone wale debits ka lender pata nahi`, "Neeche 'Naye lender?' card mein hain. Har ek ko 'MCA hai' ya 'MCA nahi' mark kar do, tool yaad rakhega.");
    const unnamed = wIn.filter((w) => !w.named);
    if (unnamed.length) F("info", `${unnamed.length} incoming wires mein sender ka naam nahi (${$(sum(unnamed, (w) => w.amount))})`, "Funding wire apne aap pehchani nahi ja sakti, Wires tab mein dekho.");
    if (txns.some((t) => /\bfdms\b/i.test(t.desc))) F("info", "FDMS ke payments mile", "Tere notes ke hisaab se FDMS (First Data Merchant Services) MCA nahi hai, isliye chhoda. FDM hota to MCA gina jaata.");
    if (txns.some((t) => /intuit.*payroll/i.test(t.desc))) F("info", "Intuit Payroll MCA nahi gina", "Notes mein Intuit Financing MCA hai, par ye payroll ke debits hain.");
    months.forEach((m) => { if (m.bank_avg !== null && Math.abs(m.bank_avg - m.adb) > 1) F("info", `${m.month}: Avg Daily Blc bank ke figure se alag`, `Bank ne ${$(m.bank_avg)} likha, mera ${$(m.adb)}. Tool mein kaunsa use hota hai friend se confirm karo.`); });
    F("info", "Unverified Deposit ka rule abhi pata nahi", "Months tab mein mobile/ATM/remote deposits ka total candidate ke taur par diya hai.");

    return { meta: { client: first.client || "", bank: first.bank || "", account: first.account || "", start: dataStart, end: dataEnd, files: sts.length, range: `${months[0].month} to ${months[months.length - 1].month}` },
      months, positions, tool_rows: toolRows, loans, unknown, wires_in: wIn, wires_out: wOut, returned, flags, settings };
  }

  function analyzeAll(statements, lenders, settings) {
    const groups = {};
    for (const s of statements) {
      const bank = s.bank.split(" online")[0].split(" activity")[0].replace("RBFCU Business Checking", "RBFCU");
      const k = bank + "|" + s.account; (groups[k] = groups[k] || []).push(s);
    }
    return Object.values(groups).map((sts) => {
      const nm = (sts.find((s) => !s.partial && s.client) || sts[0]).client || "";
      sts.forEach((s) => (s.client = nm));
      return analyzeAccount(sts, lenders, settings);
    });
  }
  MCA.analyzeAccount = analyzeAccount; MCA.analyzeAll = analyzeAll;
})();
