# Sparkpay 记账与操作手册（LHDN 向）

> 币种主账本：MYR。外币销售按「交易日月度平均汇率」确认收入；网关打款按「结算日」记已实现汇兑损益。
> 原则：**不删订单，只改状态；每笔改动留 auditLog。**

>【分】订单金额、SKU 价、开单 amountCents、退款 cents、手续费 cents

>【元】General Ledger amountMyr、结算到账、P&L、COGS 录入 cogsAmountMyr、
     供应商充值 amountMyr、会计 sales/settlement 各 *Myr 字段
---

## 金额单位（必读）

系统里有两套记法，**不要混用**：

| 区域 | 单位 | 例子 |
|------|------|------|
| **业务订单**（`order` 等） | **cent（分）** 整数 | `10000` = RM 100.00 |
| **会计账**（`acctSale` / 结算 / GL / P&L / 导出 CSV） | **MYR 小数**（令吉） | `100.00` = RM 100 |

### 会计侧怎么填

| 字段 / 场景 | 正确写法 | 错误写法 |
|-------------|----------|----------|
| Revenue_MYR / COGS_MYR | `15.50` | `1550`（那会变成 RM 1550） |
| 网关手续费、银行到账 | `2.00`、`98.00` | 用 cent |
| GL 广告支出 RM 200 | `-200` | `-20000` |
| GL 注资 RM 1000 | `1000` | `100000` |

### 对照表

| 含义 | 订单 cent | 会计 MYR |
|------|-----------|----------|
| RM 1 | `100` | `1` 或 `1.00` |
| RM 100 | `10000` | `100` |
| 支出 RM 50 | — | `-50` |

导出的 `Sparkpay-YYYY-MM-*.csv`（含 P&L）金额一律为 **RM 小数**，不是 cent。

---

## 一、系统里几张核心表

| 规范导出名 | 表 | 用途 |
|------------|-----|------|
| `01_acct_sales` | acctSale | 每笔成功销售（收入+COGS） |
| `02_acct_settlements` | acctSettlement | 网关批量到账 |
| `03_acct_settlement_orders` | acctSettlementOrder | 结算包含哪些订单 |
| `04_acct_adjustments` | acctAdjustment | 结算后的退款/作废调整 |
| `05_general_ledger` | acctGeneralLedger | 非订单流水 |
| `06_fx_monthly_rates` | fxMonthlyRate | 月度汇率底稿 |
| `07_audit_logs` | auditLog | 防篡改日志 |
| `08_pnl` | 计算/快照 | 当月损益表 |

**一键归档文件名：** `Sparkpay-2026-10-01_acct_sales.csv` …

后台路径：`/{adminPath}/accounting/pnl` → 选年月 →「一键导出当月全表」。

---

## 二、日常操作怎么记账

### 1. 客户在网站下单并支付成功（自动）

| 步骤 | 系统行为 | 你要做的 |
|------|----------|----------|
| 支付成功 | 生成/确认订单；写入 `acctSale`（Revenue_MYR、COGS_MYR、当月 FX） | 无 |
| 发货 | 供应商 API / 卡密发货 | 异常时在订单页重试或人工发货 |

**P&L：** 收入 + COGS 进入当月。

---

### 2. 人工开单 / 银行直转（客户转账到商业账户）

| 步骤 | 在哪操作 | 记账结果 |
|------|----------|----------|
| 确认到账 | 账本对账 / 手动开单（Fee=0） | 业务订单 + `acctSale`（Payment 视同已付） |
| 发货 | 订单页人工发货或供应商发货 | 与线上单相同 |

**注意：** 钱必须进**商业账户**，不要进私人账户。

**P&L：** 全额进 Sales Revenue；无网关手续费。

---

### 3. 网关批量结算到银行

| 步骤 | 在哪操作 | 记账结果 |
|------|----------|----------|
| 收到银行一笔 MYR | `会计 → 网关结算` | 新建 Settlement：填到账日、银行实收、手续费，勾选本批订单 |
| 系统自动算 | — | Gross=所选订单 Revenue 合计；Realised_FX = 银行实收 + 手续费 − Gross |

**P&L：** 手续费进营业费用；汇兑进 FX Gain/Loss。**不要**把外币订单金额直接相加。

---

### 4. 退款

| 情况 | 操作 | 记账 |
|------|------|------|
| 全额退款 | 订单页「退款」 | 订单 → REFUNDED；`acctSale` → Refunded；若已结算则写 `acctAdjustment` |
| 部分退款 | 订单页（若开放） | PARTIAL_REFUNDED + 调整金额 |

**禁止：** 直接删订单行或改历史 CSV 后不留痕。

**P&L：** Success 才计入收入；已退款订单不进当月 Revenue（或通过调整冲回）。

---

### 5. 投广告 / 服务器 / 其他商业开支

| 步骤 | 在哪操作 | GL 填写 |
|------|----------|---------|
| 银行扣款 | `会计 → 日记账与P&L` | Type=`Expense`，Amount=**负数**（如 `-500`），描述英文/马来文，**可税前扣除=是** |

**P&L：** 仅 `Type = Expense` 且 `Is_Tax_Deductible = true` 的行进入费用。系统对 `Amount_MYR` 做 **SUM（保留正负号）**：支出应为负数，SUM 后自动减少利润。

示例：

- 广告 FB：`Expense` / `-500` / `Facebook ads Oct 2026` / 可抵扣
- Cloudflare：`Expense` / `-20` / `Cloudflare Workers` / 可抵扣
- SST / WHT：`Expense` / 负数 / 写明税种 / 可抵扣

---

### 5b. 其他收入（Other_Income）

| 步骤 | 在哪操作 | GL 填写 |
|------|----------|---------|
| 非销售收入入账（利息、理赔、杂项回收等） | `会计 → 日记账与P&L` | Type=`Other_Income`，Amount=**正数**（流入），可抵扣=**否** |

**P&L：** `SUM(Amount_MYR)` 计入「其他收入」，在净利中与毛利相加。

示例：

- 银行利息：`Other_Income` / `+12.50` / `Bank interest Oct 2026`
- 供应商赔偿：`Other_Income` / `+100` / `Supplier compensation`

**不要**把客户订单收入记成 Other_Income（订单走 `acctSale`）。

---

### 6. 供应商预存款（Prepayment）

| 步骤 | 在哪操作 | GL 填写 |
|------|----------|---------|
| 转账给 MooGold / 本地供应商 | 日记账 | Type=`Prepayment`，Amount=**负数**，可抵扣=**否** |
| 客户下单 API 扣款 | 自动 | 成本进该单 `COGS_MYR`，**不是**再记一笔预存款费用 |

**P&L：** 充值**不进**费用；只有发货扣款变成 COGS 才进成本。

---

### 7. 老板从商业账户提款

| 步骤 | GL |
|------|-----|
| 转到私人账户 | Type=`Owner_Drawing`，Amount=负数，可抵扣=**否** |

**P&L：绝不进入。** 这是业主提款，不是公司费用。

---

### 8. 老板注资

| GL | Type=`Capital_Injection`，Amount=**正数** |
|----|-----|

**P&L：不进。** 属权益，不是收入。

---

### 9. 月度汇率底稿（BNM）

| 步骤 | 在哪操作 |
|------|----------|
| 每月初同步上月平均汇率 | 网关结算页 → 同步 BNM / 或 Cron |
| 手补缺失币种 | 同一页粘贴 JSON 覆盖 |

导出包里的 `06_fx_monthly_rates.csv` 即审计底稿。

---

### 10. 月末关账（推荐流程）

1. 确认本月订单退款已处理完  
2. 确认网关结算批次已录入  
3. 补齐广告/服务器/预存款/提款等 GL  
4. 打开 **日记账与P&L** → 选 `YYYY-MM` → **生成本月 P&L** 看 Net Profit  
5. **一键导出当月全表** → 下载全部 `Sparkpay-YYYY-MM-*.csv`  
6. 存到 Google Drive / R2，保留 ≥7 年  

---

## 二点五、金额正负号（强制）

`acctGeneralLedger.Amount_MYR`：**正数 = 资金流入，负数 = 资金流出**。P&L 对费用与其他收入均使用 SQL/`SUM` 语义下的有符号合计，不在汇总时擅自 `ABS` 掉符号。

---

## 三、什么进 P&L、什么不进

| 项目 | 进 P&L？ |
|------|----------|
| 成功销售 Revenue / COGS | 是 |
| 网关手续费 | 是（费用） |
| 可抵扣营业开支（`Expense` + `Is_Tax_Deductible=true`） | 是（费用；`SUM(Amount_MYR)` 保留符号） |
| 其他收入（`Other_Income`） | 是（加项；`SUM(Amount_MYR)` 保留符号） |
| 已实现汇兑损益 | 是 |
| 老板提款 | **否** |
| 供应商预存款充值 | **否**（资产） |
| 注资 | **否** |
| 退款后非 Success 销售 | 不计入收入 |

### 净利公式（系统实现）

```text
Gross Profit = Σ Revenue_MYR − Σ COGS_MYR   （当月 Success 销售）

GL Expense SUM   = Σ Amount_MYR  where Type=Expense AND Is_Tax_Deductible=true
                   （支出记负数，SUM 为负）

Other Income SUM = Σ Amount_MYR  where Type=Other_Income
                   （收入记正数，SUM 为正）

Gateway Fees     = Σ Gateway_Fee_MYR  （结算表，正数成本）

FX               = Σ Realised_FX_Gain_Loss

Net Profit = Gross Profit + GL Expense SUM + Other Income SUM − Gateway Fees + FX
```

等价表述：**毛利 − 费用 + 其他收入 + 汇兑损益**（当费用以负数入账时，`+ GL Expense SUM` 即减去费用绝对值）。

金额约定：**正数 = 流入，负数 = 流出**；不要对可抵扣费用在入库前取绝对值。

---

## 四、禁止事项

1. 物理删除订单 / 会计销售行  
2. 改历史金额不写 audit  
3. 把提款记成 Expense  
4. 把预存款充值记成当月 COGS 或费用  
5. 收入只记网关净额（必须记 Gross，手续费单独列费用）  

---

## 五、速查表

| 场景 | 页面 | Type / 动作 |
|------|------|-------------|
| 客户线上支付 | 自动 | acctSale |
| 银行直转人工单 | 账本/手动开单 | acctSale Fee=0 |
| 网关打款 | 网关结算 | Settlement |
| 退款 | 订单 | Refund + Adjustment |
| 广告/服务器/税务开支 | 日记账与P&L | Expense 负数（可抵扣） |
| 其他收入（利息等） | 日记账与P&L | Other_Income 正数 |
| 预存款 | 日记账与P&L | Prepayment 负数 |
| 老板拿钱 | 日记账与P&L | Owner_Drawing 负数 |
| 注资 | 日记账与P&L | Capital_Injection 正数 |
| 月末归档 | 日记账与P&L | 一键导出 |

## 销货成本（COGS）怎么记

主账本只认 **马币实耗**：订单字段 `cogsAmountMyrCents`（分）→ 会计 `COGS_MYR`（令吉）。

系统里成本来源用 `cogsSource` 区分：

| cogsSource | 含义 | 钱从哪扣 | 怎么录入 |
|------------|------|----------|----------|
| `LOCAL_PREPAID` | 供应商预存款 / API 扣预存 | 预存余额减少，**不是**当次银行卡新扣（充预存时已记资产） | MooGold/本地 API 发货成功后按**当次实时报价**自动写入；或后台补录 MYR |
| `CROSS_BORDER` | 跨境/淘宝等你自己银行付 | **银行卡/账户实付 MYR** | 发货后在后台填**银行实付 MYR**；可选填淘宝 CNY，系统用 BNM 算汇差 |
| `LOCAL_STOCK` | 本地自有库存/卡密 | 采购入库时已花的钱（可按批次） | 出库时按该件成本 MYR 记，或批量均摊后补录 |

### 两种钱能不能都正常录？

**能。** 关键是：

1. **预付款供应商（如 MooGold）**  
   - 充预存时：GL 记 **Prepayment（资产）**，**不进**当期 COGS。  
   - 客户单发货、API 扣预存时：才把**本次扣减对应的 MYR** 记入该订单 **COGS**（`LOCAL_PREPAID`）。  
   - 价格不固定：以发货时接口**实时报价**为准，不要死用 SKU 固定成本。

2. **你自己银行付（淘宝人工等）**  
   - 不经过供应商预存。  
   - 发货后后台 **补录 COGS = 银行流水实付 MYR**（`CROSS_BORDER`）。  
   - 可选填人民币金额；BNM 换算与实付的差额进 `fxDifference`（分析用），**P&L 销货成本仍用实付 MYR**。

同一订单只应有一种主路径：要么预存扣减，要么银行自付；不要把预存扣款和银行再付记成双倍成本。

### 操作步骤（人工淘宝）

1. 客户付款 → 收入按销售规则入账（COGS 可先为 0）。  
2. 淘宝下单并发货。  
3. 后台订单 →「补录成本」：  
   - **实付 MYR**（必填）= 银行/卡实际扣款；  
   - **淘宝 CNY**（可选）。  
4. 保存后订单 `cogsAmountMyrCents` 与会计 `COGS_MYR` 同步（若已有 acctSale 行）。

### 操作步骤（MooGold / 预存 API）

1. 确保供应商账户、binding、`maxCostMinor` 合理。  
2. 支付成功 → 自动/重试发货。  
3. 适配器 **实时 quote** → 扣预存成功后 **自动写 COGS（MYR）**。  
4. 若汇率表缺币种或金额不对：同一后台入口用「实付 MYR」纠正（会留审计痕迹）。

### 代码位置（仓库路径）

| 用途 | 路径 |
|------|------|
| MooGold 适配器 | `server/supplier/providers/moogold.ts` |
| 供应商发货主流程 | `server/supplier/process-core.ts` |
| 资格/下单前检查（含 quote） | `server/supplier/eligibility.ts` |
| 成本写入服务 | `server/order/cogs.ts`（需新增） |
| 后台补录接口 | `server/order/admin.telefunc.ts` → `onSetOrderCogs` |
| 订单表 COGS 字段 | `database/drizzle/schema-tables-a-order.ts`（`cogsSource`、`cogsAmountMyrCents` 等） |

### 禁止

- 用固定 SKU 进货价长期代替 MooGold 实时价（仅作参考/上限）。  
- 充预存时把整笔充值当 COGS。  
- 淘宝只按「CNY×BNM」入账却与银行 MYR 对不上且不留汇差。  
- 物理删除订单来「改成本」；只更新 COGS 字段并写 audit。

## 供应商预存款（MooGold 等）自我合规

### 原则
- **发票**：你从邮箱自行下载 Top-up Invoice（系统不读邮箱）。
- **银行**：保留转账水单，金额与 Invoice 一致。
- **系统**：GL 记充值与平台费；订单记 API 扣款 COGS；月末导出 CSV + 对账单。

### 系统怎么记

| 事件 | 记哪里 | Type | Amount_MYR | 抵税 |
|------|--------|------|------------|------|
| 充值预存（付完 Invoice） | `acctGeneralLedger` | `Prepayment` | **-1000**（出银行/转预存） | 否（资产，不进 P&L） |
| API 发货扣预存 | `order` + `acctSale` | COGS | **+80** 等成本 | 进 COGS |
| 钱包扣会员费 | `acctGeneralLedger` | `Expense` + 描述含 `[Platform_Fee]` | **-50** | **是** |

余额公式：

```text
期末余额 = 期初 + 本月充值 - 本月 API 扣款(COGS) - 本月平台费
```

### 后台操作（接口）

1. `onRecordSupplierTopup` — 填 Invoice 号、金额、日期、`supplierKey=moogold`
2. `onRecordSupplierPlatformFee` — 月底发现被扣会员费时补录
3. `onGetSupplierWalletStatement` — 传入上月期末作 `openingBalanceMyr`
4. `onExportSupplierCogsCsv` — 下载当月 API 扣款明细

### 每月文件夹（自建）

```text
2026-11_Supplier_Records/
  1_Topup_Invoice.pdf（邮箱下载）
  2_Bank_Transfer.png
  3_API_Deductions.csv（系统导出）
  4_Wallet_Statement.txt（系统生成）
  5_API_success_logs（可选）
```

### 对账单示例

```text
MOOGOLD Wallet Statement (Month: 2026-11)
Opening Balance,500.00
(+) Top-up,1000.00
(-) API Deductions (COGS),800.00
(-) Platform / Membership Fees,50.00
Closing Balance,650.00
```
# 账目如何区分 + 证据待补

## 两类产品
| taxCategory | 例子 | MY SST 门槛 | 代收 SST |
|-------------|------|-------------|----------|
| Digital_Goods | TikTok 钻石等 | **不计入** 50 万服务门槛 | 永远 0 |
| Digital_Service | 剪映会员等 | **仅 MY 本地** 计入门槛 | 超门槛后 MY 单可能 8% |

## 每月导出三份（分开存文件夹）
1. `sst-local-service-YYYY-MM.csv` — RMCD 服务应税监控
2. `digital-goods-local-YYYY-MM.csv` — 本地商品转售（立场非 SST 应税供应）单独存档
3. `export-all-YYYY-MM.csv` — 非 MY

## 所得税 LHDN
三行收入都进 P&L 收入侧：Local Service + Local Goods + Export。  
SST_Amount 只做 **负债**，不进收入。

## 证据待补（无 BIN / IP 冲突）
本引擎对 SST：**缺失或冲突先按 MY**（偏保守，门槛不会少计）。  
文件夹注明 `EVIDENCE_PENDING`，网关接入后用 BIN 重算或更正说明。  
出口要稳：需要 IP 与 BIN 都非 MY 且一致。


### 禁止
- 把平台费记进 COGS
- 把充值记成费用
- 无 Invoice 号的充值备注（描述里必须带 Invoice 编号）
