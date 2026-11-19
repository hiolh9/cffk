# Sparkpay Accounting Playbook

> Ledger currency: MYR. Foreign sales use monthly average FX at transaction month; gateway payouts use settlement-date realised FX.

## Units (required)

| Layer | Unit | Example |
|-------|------|--------|
| Orders / SKU price / amountCents | **cents** | `10000` = RM 100.00 |
| GL / Wallet / Settlement / P&L | **MYR major (块)** | `100.00` = RM 100 |

## Supplier top-up + FPX fee

| Field | Unit | Meaning |
|-------|------|--------|
| Top-up amount | MYR 块 | Supplier credit / invoice face |
| Channel fee (processingFeeMyr) | MYR 块 | FPX etc. bank extra — GL Expense, NOT wallet |

Bank check: top-up + fee = bank debit. Wallet closing uses top-up only.

## Multi-currency / multi-gateway

Lock original currency per order; confirm Revenue_MYR via BNM monthly average. One Settlement per payout (all MYR totals). Never sum mixed currencies directly.

See full Chinese operations guide in git history commit 215b73aa if needed for detailed LHDN steps.
