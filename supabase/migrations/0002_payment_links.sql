-- Link a cash flow (e.g. "Mortgage payment") to the account it pays down,
-- so the projection can amortize debts with real interest.
alter table cash_flows add column account_id uuid references accounts(id) on delete set null;
