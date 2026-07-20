# debts

Amortizing loans (mortgage, auto, student, personal), modeled the same way
as income and expenses but for an allocation rather than a deduction: the
`Adjustable`'s gross is the total monthly cash leaving the household
(principal + interest + optional escrow), and its adjustments decompose
that total into named portions that sum to exactly zero net — the same
reconciliation invariant `adjustable/` enforces for tax withholding,
applied here to a payment split instead.

## Entry point

`index.ts` — `computeAmortizedPaymentCents` (the standard annuity-payment
formula), `DebtConfig`/`DebtState`/`initialDebtState`/`isDebtActive`/
`applyPrincipalPayment` (advances the balance after a month), and
`buildDebtPaymentAdjustable`/`debtViews`.

## Acceptance

- `resolveAdjustable(...).netCents === 0` for every debt payment — the
  payment is always fully accounted for by principal + interest + escrow.
- The final payment on a loan never pays more than the remaining balance,
  even though the scheduled amortized payment was computed against the
  original principal/term.
- Interest shrinks and principal grows over the life of a fixed-payment
  loan as the balance amortizes down.

Depends on: `adjustable/`, `money/`, `types/`.
