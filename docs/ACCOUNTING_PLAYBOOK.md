# Sparkpay 记账与操作手册（完整版）

> **主账本币种：MYR（令吉）**  
> 外币销售：按**交易所属月**的 BNM 月均汇率确认 `Revenue_MYR`。  
> 网关打款：按**结算到账日**记已实现汇兑损益。  
> 原则：**不物理删除订单；只改状态；关键写操作留 auditLog；动账需管理员 2FA。**

品牌对外名：**Sparkpay**（仓库/Worker 名可能仍为 cffk）。

---

## 0. 先看：金额单位（最易错）

系统里有两套记法，**禁止混用**：

| 层 | 单位 | 例子 |
|----|------|------|
| 业务订单 `order`、SKU 价、`amountCents`、退款 cents | **分（cent）** 整数 | `10000` = RM 100.00 |
| 会计 `acctSale` / Settlement / GL / Wallet / P&L / CSV | **块（MYR 小数）** | `100.00` = RM 100 |

| 场景 | 正确 | 错误 |
|------|------|------|
| GL 广告费 RM 200 | `-200` | `-20000` |
| 订单金额 RM 50 | `5000` cent | `50` cent |
| 供应商充值 RM 1000 | `1000`（块） | `100000` |
| Top-up 手续费 RM 1.50 | `1.50`（块） | `150` 当分 |

导出的 `Sparkpay-YYYY-MM-*.csv` 与 P&L **一律是块（RM 小数）**。

---

## 1. 核心表与文件

| 规范名 | 表/来源 | 用途 |
|--------|---------|------|
| 01 销售 | `acctSale` | 每笔成功销售：原币、FX、Revenue_MYR、COGS_MYR、状态 |
| 02 结算 | `acctSettlement` | 网关一批打到银行的 MYR |
| 03 结算明细 | `acctSettlementOrder` | 哪些订单属于哪笔结算 |
| 04 调整 | `acctAdjustment` | 结算后的退款/作废等调整 |
| 05 日记账 | `acctGeneralLedger` | 非订单：广告、提款、预存、利息等 |
| 06 汇率 | `fxMonthlyRate` | 月度 BNM（或手补）底稿 |
| 07 审计 | `auditLog` | 谁在何时改了什么 |
| 08 P&L | 计算/快照 | 月度/年度损益 |
| 业务订单 | `order` | 前台履约、支付状态、退款 cents、税务字段 |

**一键归档：** `Sparkpay-YYYY-MM-*.csv` — 后台 `/{adminPath}/accounting/pnl`。

**关月 COGS 检查：** `onListZeroCogsSales({ yearMonth: "2026-11" })` — 当月 Success 且 COGS=0 的清单。

---

## 2. 权限与安全

| 操作 | 要求 |
|------|------|
| 查看列表、导出 CSV | 管理员（+ IP 白名单若已配） |
| 创建结算、记 GL、充值、手动开单、改汇率、退款、税批 | **管理员 + 2FA** |
| 普通用户 | 不能调会计接口 |

未开 2FA 时写账会失败。

---

## 3. 净利公式

```text
Gross Profit = Σ Revenue_MYR − Σ COGS_MYR     （当月 acctSale Status = Success）
GL Expense SUM   = Σ Amount_MYR where Type=Expense AND Is_Tax_Deductible=true  （支出为负）
Other Income SUM = Σ Amount_MYR where Type=Other_Income
Gateway Fees     = Σ Gateway_Fee_MYR
FX               = Σ Realised_FX_Gain_Loss
Net Profit = Gross Profit + GL Expense SUM + Other Income SUM − Gateway Fees + FX
```

**不进 P&L：** `Owner_Drawing`、`Prepayment`、`Capital_Injection`。  
**GL 正负号：** 正=流入，负=流出。

---

## 4. 场景索引

| # | 场景 | 节 |
|---|------|----|
| A | 线上支付成功 | 5.1 |
| B | 银行直转 + 手动开单 | 5.2 |
| C | 网关批量结算 | 5.3 |
| D | 全额退款/作废 | 5.4 |
| E | 部分退款（易漏） | 5.5 |
| F | 广告/服务器/税务开支 | 5.6 |
| G | 其他收入 | 5.7 |
| H | 预存 Top-up + FPX 费 | 5.8 |
| I | 钱包会员费 | 5.9 |
| J | 提款/注资 | 5.10 |
| K | **淘宝人工发货补 COGS** | 5.11 |
| L | MooGold 自动 COGS | 5.12 |
| M | 多币种/多网关 | 5.13 |
| N | 月末关账 | 5.14 |
| O | 填错怎么改 | 5.15 |
| P | 税务分类 | 5.16 |

---

## 5. 分场景 SOP

### 5.1 线上支付成功

1. 下单 PENDING → 支付成功 PAID  
2. 系统写入 `acctSale`（幂等）+ 税务  
3. 发货（本地/供应商）  
4. COGS：API 自动或人工补（5.11/5.12）  

**易漏：** 无 `acctSale` → 跑 Backfill。关月用 `onListZeroCogsSales`。

### 5.2 银行直转 + 手动开单

1. 钱进**商业账户**  
2. 手动开单（金额单位=**分**）；备注写清「谁转账、如何确认是本地客户」  
3. 系统：PAID、Fee=0、**强制 acctSale**、税务与发货  

**易漏：** 只改订单状态不走开单接口 → 无会计销售行。

### 5.3 网关结算

1. 对照银行/网关结单填：到账日、Bank_Received、Fee  
2. 勾选本批订单 → Gross=Σ Revenue_MYR；FX=Bank+Fee−Gross  
3. **一笔 payout = 一笔 Settlement**；不同网关分开  

**禁止：** 原币直接相加当 MYR。

### 5.4 全额退款/作废

订单页退款（2FA）→ REFUNDED；全额时关 acctSale / 写 Adjustment。禁止物理删除。

### 5.5 部分退款（易漏）

- 订单层可有 PARTIAL_REFUNDED  
- **会计 acctSale 可能仍按 Success 全额**，直到全额退或手工 mark 退款  
- 关月前维护 Refund Log：Order_ID、退款额、原因、网关退款号  

### 5.6 营业开支

GL：`Expense`，金额**负块**，可抵税=true。例：`-500` Facebook ads 2026-11。

### 5.7 其他收入

`Other_Income`，金额**正块**。不要把客户订单记这里。

### 5.8 供应商 Top-up + 渠道费

| 字段 | 单位 | 含义 |
|------|------|------|
| 充值金额 | 块 | Invoice/到账 |
| 手续费 | 块 | FPX 等，不进钱包 |

分录：Prepayment −充值；Expense −手续费 `[Topup_Processing_Fee]`。  
银行：充值+手续费=银行扣款。证据：Invoice、银行水单、COGS CSV、对账单。

### 5.9 钱包会员费

Expense + `[Platform_Fee]`，负块，可抵税。不是 COGS。

### 5.10 提款/注资

`Owner_Drawing` 负 / `Capital_Injection` 正。**不进 P&L。**

### 5.11 淘宝/跨境人工发货补成本（SOP）

1. 客户已付 → 已有 Revenue，COGS 可能为 0  
2. 淘宝下单发货，保留订单号  
3. 以**银行实付 MYR（块）**为主成本补录；`cogsSource=CROSS_BORDER`  
4. 可选填 CNY + BNM 汇差分析  
5. 关月前 `onListZeroCogsSales` 必须清零  

| 位置 | 单位 |
|------|------|
| 补录表单实付 | **块** |
| cogsAmountMyrCents | **分**（系统） |
| acctSale.COGS_MYR | **块** |

禁止：只按 CNY×随意汇率入账且与银行不符；同一单双记预存+银行。

### 5.12 MooGold 预存 API

发货成功按**实时报价**写 COGS（LOCAL_PREPAID）。充值阶段不进 COGS。

### 5.13 多币种/多网关

订单锁原币 → 月均汇率 → Revenue_MYR。结算只汇总 MYR；每笔 payout 单独 Settlement。

### 5.14 月末关账清单

**系统：** 退款处理完 → 零 COGS 检查 → 结算勾对 → GL 补齐 → 汇率齐全 → P&L → 一键导出 CSV。  
**系统外同文件夹：** BNM PDF、银行结单、网关 Payout、供应商发票、Refund Log、税务分表 CSV。

### 5.15 填错

GL 用**反向分录**冲正，描述写原 Entry_ID。禁止静默改历史抵赖。漏手续费就补 Expense。

### 5.16 税务

| 分类 | MY SST 门槛 |
|------|-------------|
| Digital_Goods | 默认不计入服务门槛 |
| Digital_Service | 仅 MY 消费地计入 |
| Export | 不进 MY 应税池，留网关证据 |

后台开单无 IP/BIN 时保守按 MY，备注写依据。报税分 Service/Goods/Export CSV，勿用全站流水当 MY SST 税基。

---

## 6. 钱包公式

```text
期末 = 期初 + 充值 − API COGS − 平台费
```

Top-up 渠道手续费不进上式（已在费用）。

---

## 7. 禁止事项

1. 物理删除订单/会计行  
2. 改数不留痕  
3. 提款当 Expense  
4. 充值当 COGS  
5. 收入只记净额  
6. 多币种原币相加  
7. 未补淘宝 COGS 就关月  
8. 假设部分退款已自动冲减 acctSale  
9. 未开 2FA 强行写账  

---

## 8. 一天示例

```text
客户付 RM100 → acctSale Revenue
MooGold 扣 RM70 → COGS 70
或淘宝银行付 RM65 → 人工补 COGS 65
月末网关到账 980（费 20）→ Settlement + FX
广告 -200 Expense
充值 1000 + FPX 1.5 → Prepayment -1000 + Expense -1.5
导出 Sparkpay-YYYY-MM-* + 银行/发票/BNM
```

---

*与「2FA 写账 + 强制 acctSale + 零 COGS 检查 + Top-up 手续费拆分」后的行为对齐。*
