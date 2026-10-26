# Sparkpay 安全加固对照清单

对照电商常见漏洞与当前实现。部署后仍需渗透抽查。

## 一、业务逻辑

| # | 风险 | 状态 | 实现要点 |
|---|------|------|----------|
| 1 | 越权改价 / 改单 | 已覆盖 | 服务端 `sku.price * qty` 计价；不信前端单价 |
| 1b | 查他人订单 | 已覆盖 | `ownerUserId` 或访客邮箱+无主订单；无凭证返回空 |
| 2 | 优惠券薅羊毛 | 已加强 | 百分比 0–100；`finalAmount ≥ 1 cent`；库存式 `reservedCount` 原子占用 |
| 3 | 越权退款 | 已覆盖 | 仅 `requireAdminSecure` |
| 4 | 幽灵单占库存 | 已覆盖 | 30 分钟未支付自动关单并释放 `physicalStock` / 优惠券 reserved |

## 二、账户认证

| # | 风险 | 状态 | 实现要点 |
|---|------|------|----------|
| 5 | 敏感操作二次认证 | 部分 | Admin step-up + 2FA；用户改密走 Better Auth |
| 6 | 撞库 / 找回 | 已覆盖 | AUTH_* 与 ORDER_CREATE_* 限流；Turnstile 可开 |
| 7 | OAuth 绑定 | 接入时必做 | state 校验、邮箱验证后再合并 |

## 三、前端与供应链

| # | 风险 | 状态 | 实现要点 |
|---|------|------|----------|
| 8 | 第三方 JS / Magecart | 运维 | 结账页勿挂不明脚本；CSP 限制 script-src |
| 9 | API 过量字段 | 部分 | 公网订单摘要字段；禁止返回 cost/内部 ID 给访客 |
| 10 | CORS 过宽 | 已加强 | 浏览器 Origin 必须与当前 Host 一致，否则 403 |

## 四、日志与运维

| # | 风险 | 状态 | 实现要点 |
|---|------|------|----------|
| 11 | 日志明文敏感 | 已加强 | `sanitizePaymentLogPayload` + `log-redact` |
| 12 | 测试接口残留 | 运维 | 生产禁止 `/debug`、`/test/pay` |
| 13 | 源码/备份暴露 | 运维 | Workers 不托管 `.git`；R2 不公开 `.sql` |

## 五、支付金额一致性

- 回调：`result.amount === record.amount`（及币种）才确认支付
- 主动查单：同样校验金额
- 网关「加价」或「结算扣费」：订单记客户实付；结算记真实 Fee / 到账

## 六、金额单位

- 订单：cent
- 会计：MYR 小数  
见 `docs/ACCOUNTING_PLAYBOOK.md`。
