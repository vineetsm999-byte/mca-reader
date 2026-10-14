/* Server ki jagah browser ke andar: UI jo "/api/..." bulata hai, uska jawab yahin se aata hai.
   Data browser ke localStorage mein rehta hai (is computer, is browser mein). */
(function () {
  const MCA = window.MCA, LS = window.localStorage;
  const SESSIONS = {};
  const load = (k, def) => { try { const v = LS.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  const save = (k, v) => LS.setItem(k, JSON.stringify(v));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  MCA.getLenders = () => load("mca_lenders", null) || clone(MCA.DEFAULT_LENDERS);
  MCA.saveLenders = (l) => save("mca_lenders", l);
  MCA.getSettings = () => Object.assign({}, MCA.DEFAULT_SETTINGS, load("mca_settings", {}));

  // ---- cases
  const IDX = "mca_case_index";
  const caseKey = (id) => "mca_case_" + id;
  const caseList = () => load(IDX, []);
  function removeCase(id) { LS.removeItem(caseKey(id)); save(IDX, caseList().filter((c) => c.id !== id)); }
  function saveCase(report, statements) {
    const m = report.meta;
    const slug = (m.client || "client").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
    const d = new Date(), pad = (n) => String(n).padStart(2, "0");
    const id = `${slug}_${m.account}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    report.case_id = id;
    const obj = { id, created: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`, meta: m, statements, report };
    const meta = { id, created: obj.created, client: m.client, bank: m.bank, range: m.range, positions: report.positions.length };
    for (let tries = 0; tries < 40; tries++) {
      try { save(caseKey(id), obj); save(IDX, [meta, ...caseList()]); return id; }
      catch (e) {
        const l = caseList(); if (!l.length) break;
        removeCase(l[l.length - 1].id);          // sabse purana case hata ke jagah banao
      }
    }
    try { obj.statements = null; save(caseKey(id), obj); save(IDX, [meta, ...caseList()]); } catch (e) {}
    return id;
  }
  const getCase = (id) => load(caseKey(id), null);

  MCA.localApi = async function (path, body, raw) {
    const u = new URL(path, "http://x"), p = u.pathname, q = u.searchParams;
    if (p === "/api/upload") {
      const t0 = performance.now(), name = q.get("name"), sid = q.get("session");
      let pages;
      try { pages = await MCA.pdfToPages(await body.arrayBuffer()); }
      catch (e) { return { ok: false, error: "Ye file PDF ki tarah khul nahi rahi (khaarab ya password wali ho sakti hai). " + (e.message || "") }; }
      const nWords = pages[0] ? pages[0].words.length : 0;
      if (nWords < 15) return { ok: false, error: "Is PDF mein text nahi hai (scanned/photo lagti hai). Abhi scanned PDF nahi padh sakta, bank se original text-wali PDF download karo." };
      const bank = MCA.identify(pages);
      if (!bank) return { ok: false, error: "bank_unknown", hint: MCA.pageText(pages[0]).slice(0, 400) };
      let st;
      try { st = bank.parse(pages); }
      catch (e) { console.error(e); return { ok: false, error: `${bank.name} ka parser is PDF par atak gaya (${e.message}). Layout badla hua ho sakta hai, ye PDF Claude ko bhej do.` }; }
      st.file = name;
      const S = (SESSIONS[sid] = SESSIONS[sid] || { statements: [] });
      S.statements = S.statements.filter((s) => s.file !== name).concat([st]);
      const cr = st.txns.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
      const db = -st.txns.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0) + (st.unparsed_debits || 0);
      return { ok: true, file: name, bank: st.bank, client: st.client, account: st.account, period: `${st.period_start} to ${st.period_end}`, txns: st.txns.length,
        credits_ok: st.stated_credits == null ? null : Math.abs(cr - st.stated_credits) < 0.02, debits_ok: st.stated_debits == null ? null : Math.abs(db - st.stated_debits) < 0.02,
        secs: Math.round((performance.now() - t0) / 100) / 10, partial: !!st.partial };
    }
    if (p === "/api/analyze") {
      const sts = (SESSIONS[body.session] || { statements: [] }).statements;
      if (!sts.length) return { ok: false, error: "Koi statement nahi mili" };
      const reps = MCA.analyzeAll(clone(sts), MCA.getLenders(), MCA.getSettings());
      reps.forEach((r) => saveCase(r, sts.filter((s) => s.account === r.meta.account)));
      return { ok: true, reports: reps };
    }
    if (p === "/api/cases") return caseList();
    if (p === "/api/case") { const c = getCase(q.get("id")); return c ? c.report : { ok: false, error: "case nahi mila" }; }
    if (p === "/api/case/reanalyze") {
      const c = getCase(body.id);
      if (!c || !c.statements) return { ok: false, error: "Is case ki statements save nahi hain (jagah kam thi). PDFs dobara daal ke naya case banao." };
      const rep = MCA.analyzeAccount(clone(c.statements), MCA.getLenders(), MCA.getSettings());
      rep.case_id = c.id; c.report = rep; c.meta = rep.meta;
      try { save(caseKey(c.id), c); } catch (e) { return { ok: false, error: "Browser ki jagah bhar gayi, purane cases hata do." }; }
      return { ok: true, report: rep };
    }
    if (p === "/api/case/delete") { removeCase(body.id); return { ok: true }; }
    if (p === "/api/lenders") { if (body === undefined) return MCA.getLenders(); MCA.saveLenders(body); return { ok: true, n: body.length }; }
    if (p === "/api/lenders/add") {
      let lst = MCA.getLenders().filter((L) => L.name.toLowerCase() !== body.name.toLowerCase());
      lst.unshift(Object.assign({ src: "added" }, body)); MCA.saveLenders(lst); return { ok: true };
    }
    if (p === "/api/lenders/setkind") {
      const lst = MCA.getLenders(); lst.forEach((L) => { if (L.name === body.name) { L.kind = body.kind; L.src = "added"; } }); MCA.saveLenders(lst); return { ok: true };
    }
    if (p === "/api/banks" || p === "/api/banks/reload") return { banks: MCA.BANKS.map((b) => b.name), errors: MCA.BANK_ERRORS || [] };
    return { ok: false, error: "unknown " + p };
  };

  // ---- backup / restore
  MCA.exportAll = function () {
    const cases = caseList().map((c) => getCase(c.id)).filter(Boolean);
    return JSON.stringify({ version: 1, lenders: MCA.getLenders(), settings: MCA.getSettings(), cases }, null, 1);
  };
  MCA.importAll = function (text) {
    const o = JSON.parse(text);
    if (o.lenders) MCA.saveLenders(o.lenders);
    if (o.settings) save("mca_settings", o.settings);
    let n = 0;
    (o.cases || []).forEach((c) => {
      if (getCase(c.id)) return;
      try { save(caseKey(c.id), c); save(IDX, [{ id: c.id, created: c.created, client: c.meta.client, bank: c.meta.bank, range: c.meta.range, positions: c.report.positions.length }, ...caseList()]); n++; } catch (e) {}
    });
    return { lenders: (o.lenders || []).length, cases: n };
  };
  MCA.resetLenders = () => LS.removeItem("mca_lenders");
})();
