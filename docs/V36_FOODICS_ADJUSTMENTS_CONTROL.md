# v36 — Foodics Discounts, Voids, Refunds, and Returns Control

## Purpose

Foodics exports include order statuses such as Done, Void, and Returned, plus discount and payment/refund fields. v36 adds a professional control layer so these records are not mixed into normal sales blindly.

## Controls added

1. **Discount detection**
   - Reads line discount fields where available.
   - Falls back to order-level discounts if line discounts are unavailable.
   - Keeps discounts analytical while posting revenue net of discount.

2. **Void treatment**
   - Voided/cancelled orders are excluded from revenue, VAT, inventory deduction, and COGS.
   - They appear as control exceptions for cashier/manager review.

3. **Return/refund order treatment**
   - Returned orders are treated as negative sales/VAT.
   - Inventory is not restored by default because prepared food is usually not reusable.
   - Future policy can allow COGS reversal by category if needed.

4. **Refund payment handling**
   - Negative payment lines are not posted as invalid negative debits.
   - They credit the mapped cash/card/receivable account.

## Next recommendation

The next phase should be v37: payment settlement and delivery app receivables, including MADA/card settlement, delivery aggregator receivable clearing, cash variance, and cashier shift reconciliation.
