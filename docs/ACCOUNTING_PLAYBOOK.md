# Sparkpay Accounting Playbook

> Ledger currency: MYR. Foreign sales use monthly average FX at transaction month; gateway payouts use settlement-date realised FX.

## Units (required)

| Layer | Unit | Example |
|-------|------|--------|
| Orders / SKU price / amountCents | **cents** | `10000` = RM 100.00 |
| GL / Wallet / Settlement / P&L | **MYR major (块)** | `100.00` = RM 100 |

| 位置 | 字段 | 单位 | 例子 |
| --- | --- | --- | --- |
| 商品 SKU 售价 | price | 分 | 10000 = RM 100.00 |
| 订单 / 支付 / 风控限额 | 金额类 | 分 |  |
| 订单成本 | cogsAmountMyrCents | 分 | 800 = RM 8.00 |
| Wallet 充值金额 | amountMyr | 块 | 1000.00 |
| Wallet 渠道手续费 | processingFeeMyr | 块 | 1.50 |
| Wallet 平台会员费 | amountMyr | 块 | 50.00 |
| 结算 Bank received / Gateway fee | *Myr | 块 |  |
| General Ledger | amountMyr | 块 | 正=进、负=出 |
| P&L / CSV 导出 |  | 块 |  |
## Supplier top-up + FPX fee

| Field | Unit | Meaning |
|-------|------|--------|
| Top-up amount | MYR 块 | Supplier credit / invoice face |
| Channel fee (processingFeeMyr) | MYR 块 | FPX etc. bank extra — GL Expense, NOT wallet |

Bank check: top-up + fee = bank debit. Wallet closing uses top-up only.

## Multi-currency / multi-gateway

Lock original currency per order; confirm Revenue_MYR via BNM monthly average. One Settlement per payout (all MYR totals). Never sum mixed currencies directly.

See full Chinese operations guide in git history commit 215b73aa if needed for detailed LHDN steps.
