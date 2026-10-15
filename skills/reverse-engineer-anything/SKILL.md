---
name: reverse-engineer-anything
description: Reverse-engineer how something works from its outputs and rebuild it so the rebuild matches the original. Works on reports and KPIs (Excel, PDF, screenshots from SAP, Locus or other ERP/DMS systems), spreadsheet formulas, dashboards, web apps and their APIs, file formats, codebases, business processes, pricing or promotion mechanics, and AI prompts or outputs. Use it whenever the user wants to find out how a number, report, system, file or workflow was produced so they can reproduce, automate or replace it. Triggers include: "reverse engineer", "แกะ", "แกะสูตร", "แกะรายงาน", "เลียนแบบรายงาน", "ทำให้ได้ตัวเลขตรงกับ", "ตัวเลขนี้มาจากไหน", "หาว่าระบบคำนวณยังไง", "clone this report", "how was this calculated", "replicate this dashboard", "figure out the logic behind", "why doesn't my number match theirs".
---

# Reverse Engineer Anything

Find the hidden logic behind something from what it produces, then rebuild that logic and **prove** the rebuild matches. The job is finished when the reproduction matches the original within an agreed tolerance and every rule has been written down. A good-sounding explanation is not enough.

Reply in the user's language. If the user writes Thai, write Thai and keep the technical terms in English.

## The core loop (applies to every target)

```
0. Frame     → what exactly are we reproducing, and what counts as "matching"?
1. Collect   → gather the original outputs plus every candidate input
2. Dissect   → describe the original's structure (grain, fields, filters, totals)
3. Hypothesize → one testable rule per field or behavior
4. Rebuild   → run the hypothesis as code (script, formula or request)
5. Diff      → compare rebuild vs original, cell by cell or row by row
6. Iterate   → explain the largest residual first, then go back to step 3
7. Document  → write the dossier: confirmed rules, open gaps, known traps
```

Never skip step 5. A rule that has not been diffed against the original is still a guess, and the dossier must label it as one.

### 0. Frame

Before touching any data, settle these points with the user, or decide them yourself and state what you decided:

- **Target artifact:** which file, screen or endpoint, and which period or version.
- **Acceptance test:** for example, "GSV per customer matches to ±1 THB, and the totals match exactly". Without this test the work never ends.
- **Why they want it:** to automate it, to audit it, or to rebuild it in another tool. This decides how much fidelity is enough.
- **Boundaries:** see *Ethics & limits* below.

### 1. Collect

- Get at least **two samples** of the original, such as two months or two customers. With one sample you can fit almost any rule; with two you can test it.
- Collect every candidate input: raw exports, master data, configuration, documentation, and the user's own knowledge of how the business works.
- If the project has a `CLAUDE.md` or a data dictionary, read it first. It often already records traps such as cancelled-invoice prefixes, unit conversions or duplicate keys.
- Large files: never read a whole multi-MB data file into context. Write a small script that prints only the shape, the first rows, distinct values and totals.

### 2. Dissect

Write down the following before forming any hypothesis:

| Question | Why it matters |
|---|---|
| **Grain**: what does one row represent? (invoice line, invoice, customer-month, …) | Most mismatches come from the wrong grain. |
| **Keys**: which columns identify a row? | You need them to join and to diff. |
| **Measures vs dimensions** | Measures get aggregated; dimensions get grouped. |
| **Totals and subtotals** | Free checksums. Reconcile them first. |
| **Filters**: what is excluded? (cancelled docs, returns, free goods, other branches, date cut-offs) | Usually the largest hidden rule. |
| **Units and rounding** (cases vs pieces, VAT incl/excl, THB vs thousands) | Small, steady differences usually come from these. |
| **Time logic** (doc date vs delivery date vs posting date, timezone, Buddhist year พ.ศ. vs CE) | The cause of off-by-one-period errors. |

### 3. Hypothesize

- Write each hypothesis as a rule that can fail, for example: *"GSV = Σ net amount excl. VAT of invoices with prefix MD, by invoice date."*
- Start from the totals and work down. If the total does not match, no per-row rule can be right.
- Prefer the simplest rule that explains the data. Add an exception only when the diff forces you to.

### 4. Rebuild

- Write the rebuild as runnable code, not as prose. Use whatever runtime the machine has. Many business PCs have Node.js but no Python, so `scripts/reconcile.js` in this skill is Node-only.
- Keep the rebuild deterministic and re-runnable on a new period with no edits.

### 5. Diff

Compare the original and the rebuild on the same keys. Use `scripts/reconcile.js` for tables:

```bash
node scripts/reconcile.js original.csv rebuild.csv --key "Customer Code" --cols "GSV,Sales in CS" --tol 1
```

The script reports rows found in only one side, rows whose values differ beyond the tolerance, and the column totals. A `.xlsx` input needs the `xlsx` npm package to be installed.

Read the diff by asking what kind of error it is:

| Pattern of the residual | Usual cause |
|---|---|
| Every row off by the same ratio (×1.07, ×12, ×24) | VAT, unit conversion or pack size |
| A few rows missing or extra | A filter or join rule (status, prefix, branch, date cut-off) |
| Totals match but rows don't | Wrong grain or wrong attribution key (salesman vs route vs customer owner) |
| Off by exactly one period | A different date field, a timezone, or a พ.ศ./CE mix-up |
| Tiny differences of 0.01 | Round-per-line vs round-at-total |
| Random, large, few rows | Manual overrides in the original. Ask the user; do not model these. |

### 6. Iterate

Go after the **largest absolute residual** first. Change one rule at a time and re-run the diff after each change. Stop when the acceptance test passes or when the remaining gap is explained, for example by manual adjustments the user confirms.

### 7. Document: the RE dossier

Write the dossier next to the rebuild, in the project's `CLAUDE.md` or in a `REVERSE-ENGINEERING.md`, using this layout:

```markdown
## <Target> — reverse-engineering notes
**Original:** <file/screen/endpoint, period>   **Acceptance:** <tolerance>   **Status:** ✅ matched | ⚠️ partial
### Confirmed rules (verified by diff)
- <field>: <rule>  — evidence: <period(s) tested, residual>
### Unconfirmed / assumptions
- <rule> — why still a guess, what would confirm it
### Known gaps
- <residual> — cause (e.g. manual override, missing input)
### Traps
- <thing that looked right but wasn't>
```

---

## Playbooks by target type

### A. Business reports and KPIs (Excel, PDF, ERP/DMS screens)
1. Match the grand total first, then one dimension at a time (by month → by salesman → by customer → by SKU).
2. Look for codes in document numbers. For example, the prefix of an invoice number often encodes its status, such as sold vs cancelled.
3. A PDF or screenshot is not data. Transcribe it into a table (one row per printed line, keep the subtotals) and then diff against that table.
4. Ratios and percentages: find the numerator and the denominator separately, and check whether the average is weighted or simple.
5. A "target" or "achievement" column usually comes from a separate master file. Ask for it rather than guessing.

### B. Spreadsheet formulas and models
- Use the actual formulas whenever you can get them (formula view, or `xlsx` with `cellFormula: true`) instead of inferring from values.
- Build a dependency graph from input cells to output cells, and follow named ranges, hidden sheets and lookups.
- Watch for hard-coded constants inside formulas and for circular or iterative calculations.

### C. Dashboards (Power BI, Looker, HTML dashboards)
- List every visual with its measure, dimension, filters and sort.
- Find out what the slicers and filters default to, and whether filters act on the page, the visual or the report.
- Diff one visual at a time against your rebuild, using the same filter state.

### D. Web apps and APIs
- Look at what the browser actually sends and receives: request URL, method, parameters, payload and response shape.
- Map each value shown on screen back to the response field it comes from, including how it is formatted.
- Use only the user's own authenticated session and their legitimate access. See *Ethics & limits*.

### E. File formats and exports
- Check the encoding (UTF-8, TIS-620/Windows-874 for Thai, UTF-16), the delimiter, the header rows and the trailer rows.
- For binary files, start with the magic bytes and look for known containers. `.xlsx`, `.docx` and many `.app` files are ZIP archives.
- Change one thing at a time in the input and watch which bytes or fields change in the output.

### F. Codebases and scripts
- Start from the entry point and the output, then trace the data flow between them. Don't read files in alphabetical order.
- Run the code with instrumented logging rather than reasoning about it statically when you can.
- Pin the behavior with tests on real samples before you rewrite anything.

### G. Business processes and workflows
- Rebuild the process from its artifacts: timestamps, document sequences, approval logs and GPS or visit logs.
- Draw the real flow, including the exception paths, and compare it with the documented flow.
- Measure the time spent in each step, and the share of cases that go through each exception path.

### H. Pricing, promotions and commercial mechanics
- Collect several real transactions both inside and outside the promotion window.
- Isolate list price → discount tiers → free goods → rebates, and check whether each one is applied per line, per bill or per period.
- Confirm the rules against the promotion document when one exists, and note any place where the actual transactions differ from it.

### I. Competitor products, strategy and offers (from public information)
- Work only from public or legitimately obtained sources: websites, shelves, flyers, published prices and reviews.
- Rebuild the likely structure (price ladder, assortment, channel mix, promotion cadence) and label it clearly as inference.

### J. AI outputs and prompts
- Collect several input→output pairs, vary one input dimension at a time, and record the invariants (format, tone, structure, refusals).
- Write a candidate prompt or spec, regenerate outputs from it, and diff them against the originals on those invariants.

---

## Ethics & limits

This skill rebuilds logic the user is entitled to understand: their own reports and data, their own systems and vendors' outputs they lawfully receive, and public information. Do **not**:

- bypass authentication, licensing, DRM, paywalls or rate limits, or use credentials the user does not own;
- extract or decompile proprietary software against its license, or harvest personal data;
- present an inferred rule as an official one. Label any rule that has not been verified by diff as an assumption.

If a request crosses one of these lines, say so plainly and offer a lawful route, such as asking the vendor, requesting an official export, or rebuilding from the user's own data.

## Quality bar before you say "done"

- [ ] The acceptance test passes on **at least two** samples or periods, or the remaining gaps are explained.
- [ ] The rebuild re-runs on a new period without manual edits.
- [ ] The dossier is written and separates confirmed rules from assumptions.
- [ ] The final reply states plainly what matches, what does not, and the reason for each gap.
