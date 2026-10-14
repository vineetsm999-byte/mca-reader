/* PDF ko browser mein hi padhta hai (pdf.js se). Output: pages = [{width,height,words:[{text,x0,x1,top}]}]
   Koi file kahin upload nahi hoti. */
(function () {
  const MCA = window.MCA;
  const CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("load fail " + src));
      document.head.appendChild(s);
    });
  }
  let lib = null;
  MCA.loadPdfJs = async function () {
    if (lib) return lib;
    if (window.pdfjsLib) return (lib = window.pdfjsLib);
    // 1) lib/ folder mein pdf.js rakha ho to (offline) 2) CDN
    const tries = [
      async () => { const m = await import("../lib/pdf.mjs"); m.GlobalWorkerOptions.workerSrc = new URL("lib/pdf.worker.mjs", document.baseURI).href; return m; },
      async () => { await loadScript("lib/pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js"; return window.pdfjsLib; },
      async () => { await loadScript(CDN + "pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + "pdf.worker.min.js"; return window.pdfjsLib; },
    ];
    let last;
    for (const t of tries) { try { lib = await t(); if (lib) return lib; } catch (e) { last = e; } }
    throw new Error("pdf.js load nahi hua. Internet check karo, ya lib/ folder mein pdf.min.js rakho. (" + (last && last.message) + ")");
  };

  // pdf.js ke text items -> words (har item ko space par tod ke x positions bata dete hain)
  MCA.itemsToWords = function (items, height) {
    const words = [];
    for (const it of items) {
      const s = it.str;
      if (!s || !s.trim()) continue;
      const x = it.transform[4], base = height - it.transform[5], w = it.width || 0, n = s.length;
      const re = /\S+/g; let m;
      while ((m = re.exec(s))) {
        words.push({ text: m[0], x0: x + (w * m.index) / n, x1: x + (w * (m.index + m[0].length)) / n, top: base - 6 });
      }
    }
    return words;
  };
  // ArrayBuffer -> pages
  MCA.pdfToPages = async function (buf, onProgress) {
    const pdfjs = await MCA.loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      pages.push({ width: vp.width, height: vp.height, words: MCA.itemsToWords(tc.items, vp.height) });
      if (onProgress) onProgress(i, doc.numPages);
    }
    return pages;
  };
})();
