/* Shuru ki lender list (tere notes + statements mein mile lenders). Browser mein edit karoge to wahan alag save hoti hai. */
window.MCA = window.MCA || {};
MCA.DEFAULT_LENDERS = [
 {
  "name": "Intuit Financing",
  "pattern": "intuit(?!.*payroll)|webbank",
  "kind": "MCA",
  "src": "notes",
  "forced_freq": "Monthly"
 },
 {
  "name": "DoorDash Capital",
  "pattern": "doordash capital",
  "kind": "MCA",
  "src": "notes",
  "forced_freq": "Monthly"
 },
 {
  "name": "Shopify Capital",
  "pattern": "shopify capital",
  "kind": "MCA",
  "src": "notes",
  "forced_freq": "Monthly"
 },
 {
  "name": "Revenued",
  "pattern": "revenued",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "PayPal (debit)",
  "pattern": "paypal(?!\\s*\\*)",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "Fundamental Capital",
  "pattern": "fundamental capital",
  "kind": "REVERSE",
  "src": "notes"
 },
 {
  "name": "UFCE / United First",
  "pattern": "\\bufce\\b|\\buce\\b|united first",
  "kind": "REVERSE",
  "src": "notes"
 },
 {
  "name": "Credibly (Retail Capital)",
  "pattern": "credibly|retail capital",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "Advance Syndicate (JJM)",
  "pattern": "advance syndicate|jjm",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "ACG LLC",
  "pattern": "\\bacg\\b",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "FDM",
  "pattern": "\\bfdm\\b",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "On Deck",
  "pattern": "on ?deck",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "Fundbox",
  "pattern": "fundbox",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "CFGMS (CFG Merchant Solutions)",
  "pattern": "cfgms|cfg merchant",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "SBFS",
  "pattern": "\\bsbfs\\b",
  "kind": "MCA",
  "src": "notes"
 },
 {
  "name": "Bizfund",
  "pattern": "bizfund",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Overton Funding",
  "pattern": "overtonfunding",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Webfunder",
  "pattern": "webfunder",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Stage Advance",
  "pattern": "stage advance",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Square Advance (Sq Advance)",
  "pattern": "sq advance",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Samson Servicing",
  "pattern": "samsonservicing",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Prosperity Fund CA",
  "pattern": "prosperityfund",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Headway Capital",
  "pattern": "headway|hwcrcvbls",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Bizpoint Cap",
  "pattern": "bizpoint",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Path 2 Capital",
  "pattern": "path 2 capital",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Expansion Capital Group",
  "pattern": "expansion ?cap",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Byzfunder (ByzFlex)",
  "pattern": "byzflex|byzwash|byzfunder",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "EBF Holdings",
  "pattern": "ebf holdings",
  "kind": "MCA",
  "src": "keyword"
 },
 {
  "name": "Square Capital (Square Loans)",
  "pattern": "square inc.{0,40}sq cap",
  "kind": "MCA",
  "src": "keyword",
  "hidden_repay": true,
  "note": "Square ka repayment sales se katta hai, bank mein alag debit nahi dikhta."
 },
 {
  "name": "LSL 8335758634",
  "pattern": "\\blsl\\b",
  "kind": "REVIEW",
  "src": "added"
 },
 {
  "name": "Lendistry Sblc",
  "pattern": "lendistry",
  "kind": "REVIEW",
  "src": "keyword"
 },
 {
  "name": "Nmef 2024-A",
  "pattern": "nmef",
  "kind": "REVIEW",
  "src": "keyword"
 },
 {
  "name": "Cadence/Huntington Icpayment",
  "pattern": "icpayment",
  "kind": "REVIEW",
  "src": "keyword"
 },
 {
  "name": "Flexible Financ",
  "pattern": "flexible financ",
  "kind": "REVIEW",
  "src": "keyword"
 },
 {
  "name": "KCAuthorization",
  "pattern": "kcauthorization",
  "kind": "REVIEW",
  "src": "keyword"
 },
 {
  "name": "Alternative Funding Solutions (CA47)",
  "pattern": "alternative funding",
  "kind": "REVIEW",
  "src": "keyword"
 },
 {
  "name": "American Express Loan",
  "pattern": "american express loan",
  "kind": "LOAN",
  "src": "keyword"
 },
 {
  "name": "Lease Services",
  "pattern": "lease services",
  "kind": "LOAN",
  "src": "keyword"
 },
 {
  "name": "GM Financial",
  "pattern": "gm financial",
  "kind": "LOAN",
  "src": "keyword"
 },
 {
  "name": "BMW Financial",
  "pattern": "bmwfinancial|bmw financial",
  "kind": "LOAN",
  "src": "keyword"
 },
 {
  "name": "Kenworth Sales (truck)",
  "pattern": "kenworth",
  "kind": "LOAN",
  "src": "keyword"
 },
 {
  "name": "FDMS (First Data) - notes: MCA nahi",
  "pattern": "\\bfdms\\b",
  "kind": "NOT_MCA",
  "src": "notes"
 },
 {
  "name": "KLC / Crystal Cap - home loan",
  "pattern": "\\bklc\\b|crystal ?cap",
  "kind": "NOT_MCA",
  "src": "notes"
 },
 {
  "name": "Payroll (Intuit/ADP wage)",
  "pattern": "intuit.*payroll|payroll|wage pay|\\badp\\b",
  "kind": "NOT_MCA",
  "src": "keyword"
 },
 {
  "name": "Cards (Amex, Credit One, Chase, Synchrony, Wells card, Capital One)",
  "pattern": "amex|american express|credit one|concora|\\bsyf\\b|synchrony|capital one|chase credit|wells fargo card|wf ach_payments|cc payment",
  "kind": "NOT_MCA",
  "src": "keyword"
 },
 {
  "name": "Auto/lease (Ally, Toyota)",
  "pattern": "\\bally\\b|toyota ach|toyota lease|leasechg",
  "kind": "NOT_MCA",
  "src": "keyword"
 },
 {
  "name": "Insurance",
  "pattern": "new york life|broad ins|state farm|farmers|guardian pro|pie insurance|acuity|marsh fdx|texas county|elephant|insurance",
  "kind": "NOT_MCA",
  "src": "keyword"
 },
 {
  "name": "Telecom / utilities",
  "pattern": "\\batt\\b|vonage|verizon|vzwrlss|comcast|lumen|spectrum|sdge|gas & elec|cps ?energy|saws|starlink|siriusxm|sxm",
  "kind": "NOT_MCA",
  "src": "keyword"
 },
 {
  "name": "Tax",
  "pattern": "irs usataxpymt|tax paymnt|utah801",
  "kind": "NOT_MCA",
  "src": "keyword"
 },
 {
  "name": "Fees / subscriptions",
  "pattern": "maint\\.? ?fee|service charge|webpaymentfee|clover fee|sq\\d{6}|upgrade, inc|morgan harris",
  "kind": "NOT_MCA",
  "src": "keyword"
 },
 {
  "name": "Transfers / personal",
  "pattern": "^zel|^zelle|internet transfer|online transfer|apple cash|venmo|cash app|money transfer|\\bwithdrawal\\b|atm ",
  "kind": "NOT_MCA",
  "src": "keyword"
 }
];
MCA.DEFAULT_SETTINGS = {low_balance: 1000, unknown_min_amount: 100, unknown_min_count: 3};
