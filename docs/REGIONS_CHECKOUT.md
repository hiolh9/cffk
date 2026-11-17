# Regions / currency / payment methods

## Accounting

- Order stores **charge currency + amount** (what the customer pays / gateway charges).
- `Revenue_MYR` uses locked FX (BNM monthly average) at payment time.
- Gateway payouts are recorded in **MYR only**; realised FX = bank received + fees − sum(Revenue_MYR of linked orders).

## Admin

Path: `/system/regions` (under your admin path prefix).

1. Run migration `0028_regions_checkout_json.sql` on D1 (adds `siteSetting.regionsConfigJson`).
2. Edit JSON: regions (country → currency rules) and paymentMethods (fee markup).
3. Enable a payment method (`enabled: true`) only after the gateway adapter is live.

## Defaults

- MY → MYR forced
- AU → AUD forced
- US + REST → USD forced
- Payment markups are disabled until you turn `enabled` on

## Checkout quotes

`listPaymentQuotesForRegion` returns list price vs final charge per method for UI.
