# expenses

Recurring expenses (rent, groceries, insurance, discretionary spending),
modeled as `Adjustable`s with an empty pipeline by default so a
reimbursement/subsidy/discount can be added later as a line item without
changing this folder's shape. Escalates by an annual inflation rate,
compounded once per year active — matching how real cost-of-living
increases work, not a monthly compounding approximation.

## Entry point

`index.ts` — `ExpenseConfig`/`ExpenseState`/`isExpenseActive`,
`buildExpenseAdjustable(state, currentMonth)`, `expenseViews(result,
category)`.

## Acceptance

- `outOfPocketCents === totalMonthlyCents` whenever `adjustments` is empty.
- Inflation compounds annually, not monthly.

Depends on: `adjustable/`, `money/`, `types/`.
