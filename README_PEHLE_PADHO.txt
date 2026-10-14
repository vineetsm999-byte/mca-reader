MCA STATEMENT READER (browser version, install ki zarurat nahi)
================================================================
Bank statement PDF daalo, MCA ka hisaab (lender, EMI, frequency, advance, Reverse/Refinance draft,
month-wise Funding/Transfers/NSF/ADB, wires) mil jaata hai.
PDF tere browser ke andar hi padhi jaati hai. Kisi server par upload nahi hoti.

GITHUB PAR LAGANA (ek baar, 10 minute)
--------------------------------------
 1. github.com par account banao -> New repository -> naam: mca-reader -> Private (ya Public) -> Create.
 2. "uploading an existing file" par click karo, is folder ki SAARI files (index.html, js, lib, .nojekyll ...) drag karo,
    "Commit changes" dabao.
 3. Repository > Settings > Pages > "Deploy from a branch" > Branch: main, folder: /(root) > Save.
 4. 1-2 minute baad wahi page par link dikhega: https://TUMHARA-NAAM.github.io/mca-reader/
    Wo link friend ko de do. Bas browser mein kholna hai.
 Dhyan: GitHub Pages ka free link public hota hai (code dikh sakta hai, par client ka data nahi, wo kabhi upload nahi hota).
 Private repo se Pages ke liye GitHub ka paid plan chahiye; free mein repo Public rakho.
 Link ko seedha double-click karke bhi chala sakte ho (index.html), bas wahan pdf.js internet se aayega.

ROJ KA KAAM
-----------
 1. Link kholo. 2. "Naya case" mein client ki saari statements ek saath daalo.
 3. Har file par "padh liya" + "bank ke total se match" dikhe to numbers pakke hain.
 4. "Analyze karo". Months / MCA positions / Wires / Check karo tab milte hain. Copy button se number copy karo.

DATA KAHAN RAHTA HAI
--------------------
 Lender list aur purane cases tere browser (localStorage) mein save hote hain, isi computer + isi browser mein.
 "Backup" tab se file download kar lo, warna browser saaf karne par ya dusre computer par nahi milenge.
 Backup file mein client ka data hota hai, kisi ko mat bhejna.

NAYA LENDER: "Lender list" tab mein jodo, ya MCA tab ke neeche "Naye lender?" mein 'MCA hai / MCA nahi' dabao.
NAYA BANK  : sample statement Claude ko bhejo -> wo js file dega -> js/banks/ mein daalo -> js/banks/registry.js
             mein naam jodo -> GitHub par commit. (Template: js/banks/_template.js.txt)
 Abhi ye banks padhta hai: PNC, Wells Fargo, RBFCU (statement + online-banking print).

SEEMAYEIN
---------
 - Sirf text wali PDF (scanned/photo nahi). Har naye bank ke liye ek parser file chahiye.
 - Reverse / Refinance / Add-on ka tag "draft" hai, final faisla friend ka.
 - Naam se pakde lenders (Bizfund, EBF wagairah) friend confirm kare.
 - Unverified Deposit aur Low Blc Days ka rule pata nahi, confirm karna hai.
 - lib/ folder mein pdf.js (Apache-2.0 license) saath hai, isliye CDN par nirbhar nahi.
