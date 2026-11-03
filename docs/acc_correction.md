# 记账填错怎么改（更正与冲销手册）

> 适用：Sparkpay / Cloudflare D1 账本（订单 COGS、General Ledger 预存款与费用、月度对账单与 CSV）。  
> 原则：**不删历史、只纠正数字；每笔更正可追溯。**

---

## 1. 总原则

1. **禁止**为了“改数字”而物理删除订单、已成功的供应商单或已入账的关键流水。
2. **优先**：改可改字段（如订单 COGS）并写审计日志；不能改则用 **冲销分录 + 重录正确分录**。
3. 更正后必须：
   - 重新生成该月 **供应商对账单**（如适用）；
   - 重新导出该月 **COGS CSV**（如适用）；
   - 在当月凭证文件夹留下 **更正说明**（见第 7 节）。
4. 月末与 **银行水单、供应商后台余额、系统 Closing Balance** 三方（或至少两方）再对一次。

### 金额符号约定（会计侧 MYR）

| 场景 | 常见记法 |
|------|----------|
| 预存款充值（银行 → 供应商钱包） | GL `Prepayment`，金额为 **负数**（如 `-1000`） |
| 平台/会员费（钱包扣费） | GL `Expense` + 描述含 `[Platform_Fee]`，金额为 **负数**（如 `-50`） |
| 冲销上述流出 | 录一笔 **相反符号** 的同类型（或明确写 Reversal），金额绝对值相同 |
| 订单销货成本 | 订单 `cogsAmountMyrCents` / 会计 `COGS_MYR`，为 **正的成本额**（如 `80.00`） |

---

## 2. 预存款充值（Top-up）填错

对应后台：`预存款对账` → 记录充值；接口 `onRecordSupplierTopup`。  
Invoice 格应填 **充值发票编号**（邮箱下载的 PDF 上的号），不是客户订单号，也不是 API `upstreamOrderId`。

### 2.1 金额多记或少记

**做法：冲销 + 重录。**

1. 查清错误分录：金额、日期、Invoice 号、`[supplier:xxx]`。
2. 再录一笔 **冲销**：
   - 类型：仍为 `Prepayment`；
   - 金额：与错误分录 **相反**（若错记 `-1000`，冲销为 `+1000` 或按系统约定输入使净效果为零）；
   - 描述示例：`Reversal of wrong top-up GL-xxx / Invoice #旧号 [supplier:moogold]`。
3. 再录一笔 **正确 Top-up**：
   - 金额：正确充值额；
   - Invoice #：正确发票号；
   - 描述可写：`Corrected top-up Invoice #新号 [supplier:moogold]`。
4. 用正确 **期初** 重新生成该月 Wallet Statement，确认期末与供应商后台一致。

### 2.2 只写错 Invoice 号（金额正确）

1. 若系统 **不支持编辑** GL 描述：按 2.1 **全额冲销后重录**，Invoice 填正确号。
2. 若日后支持编辑 description：只改编号，并在描述末尾追加 ` | corrected invoice ref on YYYY-MM-DD`。
3. 文件夹中：保留错误号对应的旧说明或邮件，并注明以哪张 PDF 为准。

### 2.3 记错供应商（supplierKey）

1. 冲销错误供应商标签下的那笔 Prepayment。
2. 用正确 `supplierKey`（如 `moogold`）重录。
3. 分别生成两个供应商的对账单时，避免串户。

### 2.4 记错日期（跨月）

1. 若仅差几天且同月：可冲销后按正确 `entryDate` 重录。
2. 若跨月：在 **错误月份** 冲销，在 **正确月份** 记正确 Top-up；两个月的 Statement 都要重跑。
3. 归档文件夹按 **业务发生月** 归类 Invoice 与银行水单。

---

## 3. 平台费 / 会员费填错

对应：`onRecordSupplierPlatformFee`；类型为 **Expense（可抵税）**，**不是 COGS**。

### 3.1 金额错误

1. 冲销：再录一笔相反金额的平台费（描述含 `[Platform_Fee]` 与 `Reversal of …`）。
2. 按正确金额重录。
3. 重算该月 Wallet Statement（平台费行会变）。

### 3.2 误记成订单 COGS

1. 用订单 COGS 更正功能，把该单 **错误成本改回** 正确值（或 0 若本不应有该成本）。
2. 在 GL 补录正确的 **Platform_Fee**。
3. 确认 P&L：COGS 下降、Operating Expense 增加（若金额对，利润影响应合理）。

### 3.3 漏记

直接补录一笔即可，日期用供应商实际扣费日；描述写清月份与供应商。

---

## 4. 订单 COGS 填错

对应：订单后台补录 / `onSetOrderCogs`；字段如 `cogsAmountMyrCents`、`cogsSource`、可选 CNY 与汇率。

### 4.1 淘宝人工单（CROSS_BORDER）

- **主数字**：银行实付 **MYR**。
- 填错时：再次提交正确 MYR（及可选 CNY）；以 **最后一次正确保存** 为准。
- 保留淘宝订单号、银行扣款截图；更正说明中写清旧金额 → 新金额。

### 4.2 供应商预存款扣款（LOCAL_PREPAID）

- 优先以发货成功时系统写入的成本为准；人工改过则以人工为准并写审计。
- 改 COGS **不会**自动改供应商后台余额，只改你方账本；对账时要与 `supplierOrder` 成本、钱包余额一起看。

### 4.3 禁止

- 删除已支付订单以“重做成本”。
- 把平台费、充值、广告费写进单笔订单 COGS。

---

## 5. 对账单与 CSV

### 5.1 期初余额（Opening）填错

- 当前设计中，期初多为 **查询参数**，不永久锁死。
- 用 **上月正确 Closing** 作为本月 Opening，重新点「生成对账单」即可。
- 已放入文件夹的错误文件：保留并另存 `*_CORRECTED` 版本。

### 5.2 API 扣款 CSV

- 导出条件依赖订单上的预存款类 COGS（如 `LOCAL_PREPAID`）。
- 更正 COGS 后 **重新导出** 该月 CSV。
- 旧 CSV 不要覆盖删除：可改名为 `API_Deductions_YYYY-MM_superseded.csv`。

### 5.3 对账单公式（核对用）

```text
Closing = Opening + Top-ups - API COGS (LOCAL_PREPAID) - Platform fees
```

与供应商后台钱包余额差额应为 0（允许未入账时间差，但月末应解释清楚）。

---

## 6. 收入、结算、其它 GL

| 错误类型 | 建议 |
|----------|------|
| 手动开单金额错误 | 按退款/作废流程处理订单状态；必要时冲销相关会计销售行（若有），不要静默改历史无痕 |
| 网关结算批次勾错订单 | 在结算模块按系统规则解除/重关联（若支持）；否则文档记录错误批次并做调整分录 |
| 业主提款记成费用 | 冲销 Expense，改记 `Owner_Drawing`（不可抵税） |
| 广告/服务器费用记错 | Expense 冲销后重录；保持 `Is_Tax_Deductible` 正确 |

具体菜单以当时后台为准；逻辑仍是 **冲销或状态变更 + 审计**。

---

## 7. 当月文件夹更正说明（模板）

路径示例：`2026-11_Supplier_Records/CORRECTIONS.md`

```text
# Corrections — 2026-11

## 2026-11-05
- Type: Top-up reversal + repost
- Wrong: Prepayment -1000, Invoice #INV-OLD, entry approx GL-...
- Action: Reversal +1000; new Top-up -800, Invoice #INV-88
- Bank slip: bank_2026-11-05.png
- Statement regenerated: Wallet_Statement_2026-11_CORRECTED.txt
- Operator: (name)

## 2026-11-12
- Type: Order COGS correction
- Order_ID: INV-2026-0123
- Old COGS_MYR: 50.00 → New: 47.30 (bank actual)
- Note: Taobao paid CNY xx, bank MYR 47.30
```

---

## 8. 操作检查清单（每次更正后）

- [ ] 错误分录已冲销或字段已改，且描述含 Reversal/Corrected
- [ ] 正确分录已入账（金额、日期、供应商、Invoice/订单号）
- [ ] 相关订单 COGS / 状态与业务事实一致
- [ ] 该月 Wallet Statement 已重生成，Closing 与供应商后台可解释一致
- [ ] 该月 COGS CSV 已重导出（如有影响）
- [ ] 凭证文件夹已更新 Invoice/水单/更正说明
- [ ] 未使用“删除订单/删除 GL”作为更正手段

---

## 9. 与审计、税务的关系

- LHDN 可接受完整的 **内部电子记录**，前提是每笔钱能对上 Invoice、银行、系统明细。
- 更正不是造假：保留 **错误记录 + 冲销 + 正确记录** 比“消失的一笔”更安全。
- 平台费进 **营业费用**，充值进 **预付账款（资产）**，API 扣款进 **COGS**——更正时不要改错分类。

---

## 10. 系统能力与后续增强（备忘）

| 能力 | 说明 |
|------|------|
| 订单 COGS 更正 | 使用现有补录接口；应保留 audit |
| Top-up / 平台费 | 以新增 GL 为主；无编辑界面时用冲销重录 |
| 供应商 API 成功 | 见 `supplierOrder`（`supplied`、`upstreamOrderId`），非 Invoice 格 |
| 建议增强 | GL 作废（void）关联原 `entryId`、必填更正原因、禁止物理删除 |

---

## 11. 相关文档

- 主手册：`docs/ACCOUNTING_PLAYBOOK.md`
- 预存款自我合规：同文件中「供应商预存款（MooGold 等）自我合规」章节
- 代码：`server/accounting/supplier-wallet.ts`、`server/order/cogs.ts`、会计后台 `onRecordSupplier*` 接口

**一句话：填错 → 冲销或改 COGS → 重导出对账单/CSV → 文件夹写清更正说明；永不静默删除。**
