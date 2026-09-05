# MoneyWiz-Shortcut

Turn Chinese payment screenshots into MoneyWiz transactions with one tap.

Share a screenshot of an order/bill from **JD (京东), Taobao (淘宝/天猫), PDD (拼多多), WeChat Pay (微信支付) or Alipay (支付宝)** to an iOS Shortcut. The Shortcut OCRs the image, a Scriptable script (built from this repo) detects the platform, extracts the payment details, picks a category — **Baby / Food / Transport / Shopping** — and saves the expense to MoneyWiz via its URL scheme.

```
Screenshot ──▶ Shortcut (Extract Text from Image, on-device OCR)
                  │ OCR text
                  ▼
              Scriptable: dist/MoneyWiz.js
                  ├── Parser    detect JD / Taobao / PDD / WeChat / Alipay,
                  │             extract amount·merchant·product·date·order id
                  ├── Category  keyword rules → Baby / Food / Transport / Shopping
                  └── MoneyWiz  build moneywiz://expense?... URL
                  │ result dictionary (summary + url)
                  ▼
              Shortcut: confirm alert ──▶ Open URL ──▶ MoneyWiz saves it
```

## Repo layout

```
src/
├── parser/         platform parsers (jd, taobao, pdd, wechat, alipay + shared utils)
├── category/       keyword rules for Baby / Food / Transport / Shopping
├── moneywiz/       moneywiz:// URL scheme builder
├── config.ts       ⚙️ your accounts, currency, category names
└── main.ts         Scriptable entry point
dist/MoneyWiz.js    generated single-file Scriptable script (install this)
dist/MoneyWiz.shortcut  generated + signed iOS Shortcut (AirDrop to iPhone)
scripts/            esbuild bundler + .shortcut generator/signer
test/               node:test suite with OCR fixtures per platform
```

TypeScript 7 checks the source, esbuild bundles it, Node 24 runs the `.ts` tests directly.

## Requirements

- iOS **Shortcuts** (built in)
- [**Scriptable**](https://apps.apple.com/app/scriptable/id1405459188) (free) — runs the parsing engine
- **MoneyWiz** with the URL scheme (`moneywiz://`) — see the [official docs](https://help.wiz.money/en/articles/4525440-automate-transaction-management-with-url-schemas)

## Setup

### 1. Configure

Edit `src/config.ts`:

- `accounts` — which MoneyWiz account each platform books to (names must match MoneyWiz exactly; spaces are stripped automatically as the scheme requires).
- `categoryNames` — your MoneyWiz category names for Baby/Food/Transport/Shopping (`Parent/Child` works). **The categories must already exist in MoneyWiz.**
- `save` — `true` saves silently; `false` opens MoneyWiz's prefilled New Expense screen instead.

Then build & test:

```sh
npm install
npm test        # typechecks, bundles dist/MoneyWiz.js, runs the test suite
```

### 2. Install the script in Scriptable

Copy `dist/MoneyWiz.js` into `iCloud Drive/Scriptable/` (or create a new script named **MoneyWiz** in Scriptable and paste the file's contents). It appears in Scriptable as **MoneyWiz**.

### 3. Generate the Shortcut

Two variants; both are generated programmatically — a `.shortcut` file is a
plist of `WFWorkflowActions` — and signed with macOS's built-in
`shortcuts sign` (required for import since iOS 15).

```sh
npm run shortcut:pure   # dist/MoneyWiz-Pure.shortcut — 100% built-in actions
npm run shortcut        # dist/MoneyWiz.shortcut      — Scriptable-powered
```

**Pure variant (no extra apps, zero prompts):** share a screenshot from
Photos, or tap the shortcut → native photo picker → ~150 built-in actions — OCR →
Match Text regex chains → keyword categorization → URL. It never asks for
input: amount priority is 实付 (same line, last number) → 合计 → OCR-split
实付 → 价格/付款/金额 (¥ required) → standalone amount line; unmatched
categories silently fall back to Shopping; anything the OCR misses stays
empty. With `save=false` (the default in `src/config.ts`) MoneyWiz opens its
prefilled New Expense screen, so reviewing and correcting happens there — one
tap to save. The regexes live in `src/pure/patterns.ts` (tested by
`test/pure.test.ts`). Trade-offs vs the Scriptable engine: no product-title
description, a cruder payee line, and dates take the first full timestamp on
screen.

**Scriptable variant:** richer parsing (the full TypeScript engine from
`src/`), but requires the free Scriptable app plus the MoneyWiz script
(steps 1–2) on the phone.

Install either one:

- **AirDrop** the `.shortcut` file to your iPhone and open it, or
- **double-click it on this Mac** — it imports into Shortcuts and syncs to your iPhone via iCloud.

Signing note: the generator tries `--mode anyone` first and falls back to
`--mode people-who-know-me` (Apple's *anyone* service is flaky); the fallback
imports fine on your own devices.

### 3b. Or build the Shortcut manually

Equivalent to the generated one — create a new Shortcut with these actions:

| # | Action | Configuration |
|---|--------|---------------|
| 1 | *(Shortcut settings)* | Show in Share Sheet, accepts **Images** |
| 2 | **Extract Text from Image** | Input: Shortcut Input |
| 3 | **Run Script** (Scriptable) | Script: `MoneyWiz` · Parameter: *Text from Step 2* · Show When Run: **off** |
| 4 | **Get Dictionary Value** | key `error` from *Script Result* |
| 5 | **If** | *Dictionary Value* has any value → **Show Alert** (error) → **Stop Shortcut** |
| 6 | **Get Dictionary Value** | key `summary` from *Script Result* |
| 7 | **Show Alert** | "Save to MoneyWiz?" with *summary* — Cancel aborts |
| 8 | **Get Dictionary Value** | key `url` from *Script Result* |
| 9 | **Open URLs** | *Dictionary Value* — MoneyWiz opens and saves the expense |

Now share any supported payment screenshot → confirm the parsed summary → done.

The script returns a dictionary: `ok, platform, platformLabel, merchant, description, amount, date, category, account, url, summary` (or `ok=false` with `error`), so you can extend the Shortcut freely.

## How parsing works

Every parser scores the OCR text against weighted platform keywords (e.g. 京东/交易快照 for JD, 拼多多/拼单 for PDD, 商户全称/零钱 for WeChat); the highest score wins, so "a PDD order paid via WeChat" still books as PDD. The winner then extracts:

- **amount** — the *actually paid* figure (实付款/合计/实付), preferring the last ¥ amount on the line so discounts (共减¥24) and original prices are skipped; on JD the value column can sit a dozen lines below its label, so 实付款 is searched that far ahead before the per-item 到手 price is considered. WeChat/Alipay use the standalone amount near the top of the bill.
- **date** — 支付时间/付款时间/创建时间 → `yyyy-MM-dd HH:mm:ss` (MoneyWiz's expected format).
- **merchant / product / order id** — storefront line, title lines, 订单编号/交易单号.

Categories come from keyword lists in `src/category/keywords.ts` (matched against merchant + product, first hit wins, Alipay's own 账单分类 row is used as a fallback hint). **Add your own keywords there** — it's the main tuning knob.

When nothing matches, the default depends on the platform: **WeChat and Alipay fall back to Groceries** (scan-to-pay bills are overwhelmingly corner shops and food markets), while **JD, Taobao and PDD fall back to Shopping**. Both defaults live in `PLATFORM_FALLBACK_CATEGORIES` in the same file.

### English-locale screenshots

WeChat and Alipay in English are supported alongside the Chinese UI. WeChat's English bill is the harder case and drives several of the parsing rules:

- The page never prints the word "WeChat", so detection keys off UI strings unique to it (`Transactions`, `Transaction Services`, `Payment successful`, `Initiate Split Bill`).
- Vision emits the detail table as **two separate blocks** — every label, then every value — and wraps long labels across lines (`Payment` / `Method`). `pairDetachedLabelColumn` rejoins the wrapped labels and pairs the two columns positionally, which is how `Payment Time`, `Products` and the order number are read at all.
- Timestamps arrive as `2026/9/5 07:58:56`, so the pure variant normalizes the separators and zero-pads the month and day before handing the date to MoneyWiz.
- Order numbers wrap onto a second line and are glued back together.

## Development

```sh
npm run typecheck      # TypeScript 7, no emit
npm run build          # bundle dist/MoneyWiz.js with esbuild
npm run shortcut       # generate + sign the Scriptable variant (macOS only)
npm run shortcut:pure  # generate + sign the pure built-in-actions variant
npm test               # typecheck + build + node --test (runs .ts directly)
```

To support a new platform, add `src/parser/<name>.ts` implementing `PaymentParser` (see `src/types.ts`), register it in `src/parser/index.ts`, and add a fixture + test. If a real screenshot parses wrongly, paste its OCR text (Shortcuts → Extract Text from Image → Quick Look) into a fixture and adjust the parser until the test passes.
