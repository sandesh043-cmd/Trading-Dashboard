# Professional Financial Dashboard Architecture

Date: 2026-05-21
Status: Architecture baseline for a future build

This document captures the architecture, tools, workflow, and operating rules
decided for the new professional financial dashboard. It intentionally avoids UI
design details. UI/visual design should be planned separately.

This revision includes Claude's second-opinion review and the final agreed
changes from that review.

---

## 1. Product Direction

Build a private professional dashboard that starts as a portfolio manager and
can grow into a broader professional command center for trading, journaling,
finance, research, news, analytics, and future tools.

The first build should focus on one main product area:

- Portfolio consolidation
- Current balances by exchange, sub-account, wallet, and asset
- Current balances by blockchain wallet
- Consolidated holdings across all sources
- Manual refresh
- Scheduled refresh a few times per day
- Transaction/activity import from exchanges first
- On-chain wallet balances and basic transfers first
- Permanent daily portfolio growth history

The architecture must support future expansion without creating a single-file
monolith. This is a completely new standalone project with no connection to any
existing dashboard or data source.

---

## 2. Core Architecture Decisions

| Area | Decision |
|---|---|
| Frontend | React + TypeScript + Vite |
| Hosting | Netlify |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Backend/API layer | Supabase Edge Functions |
| Scheduled jobs | Supabase Cron with per-source fan-out |
| Secrets | Supabase Vault + Edge Function secrets |
| Package manager | pnpm |
| Unit tests | Vitest |
| Browser tests | Playwright |
| Planning | Linear |
| Code hosting | GitHub |
| Deployment | Netlify auto-deploy from GitHub |
| Environments | Local + production for v1 |
| Cost goal | Free-tier-first, $0/month unless usage later forces a choice |
| V0 fallback | Local sync script may write to Supabase before Edge Functions are finalized |
| Price/FX ownership | Backend owns price and FX fetching/caching; frontend reads stored values only |

---

## 3. Non-Negotiable Principles

1. No financial secrets in frontend code.
2. Browser never calls exchange APIs directly with private keys.
3. Exchange API keys must be read-only, with withdrawal disabled.
4. Use IP allowlisting only where practical and supported by the deployment path.
5. Store normalized financial facts, not raw API dumps.
6. Current holdings can be overwritten on refresh.
7. Transactions/events should be append-only where possible.
8. Daily portfolio snapshots should be kept permanently.
9. Raw/debug payloads should be kept only temporarily, usually 7-30 days.
10. All database schema changes go through committed Supabase migrations.
11. Every user-owned table gets `user_id` and RLS, even if the app starts as single-user.
12. Each source connector is isolated and converts source-specific data into common internal formats.
13. Manual refresh and scheduled refresh use the same backend sync path.
14. Every meaningful build task should be tracked through Linear + GitHub + PR.
15. Every connector must be idempotent.
16. Every refresh must create a sync record.
17. Every stored financial value must include currency context.
18. Derivatives/perpetual positions are first-class data, not spot holdings.
19. Gas fees must be captured from day one for on-chain activity.
20. Backups are first-class for financial data.

---

## 4. High-Level System Flow

```txt
Netlify frontend
  -> Supabase Auth
  -> Supabase Postgres reads through RLS
  -> Manual refresh button
      -> refresh orchestrator Edge Function
      -> per-source sync function invocation
      -> source connector
      -> exchange API / chain indexer / price provider
      -> normalized writes to Supabase

Supabase Cron
  -> same refresh orchestrator
  -> per-source sync function invocation
  -> normalized writes to Supabase
  -> daily snapshots
```

Netlify should only serve the frontend. It should not store secrets, run exchange
syncs, or call financial APIs directly. The frontend should not call price APIs
directly either; it reads cached prices and calculated values from Supabase.

---

## 5. Source Connector Strategy

Initial sources:

- Bybit
- Coinbase
- Hyperliquid
- Ethereum wallet(s)
- Solana wallet(s)

Future sources should be easy to add:

- Base
- Arbitrum
- Polygon
- Optimism
- Bitcoin
- Additional exchanges
- Additional wallets
- Additional indexers

Connector rule:

```txt
source-specific API response
  -> connector normalizer
  -> common holdings/events format
  -> database upsert/insert
```

The core portfolio system should not know the details of Bybit, Coinbase,
Hyperliquid, Ethereum, Solana, or any future chain. That detail belongs inside
the connector.

Before standardizing the connector interface, build one real source proof of
concept end to end. The first connector should teach the interface. Do not design
the final abstraction entirely in the abstract.

Suggested connector folder shape:

```txt
supabase/
  functions/
    refresh-portfolio/
      index.ts
    connectors/
      bybit/
      coinbase/
      hyperliquid/
      ethereum/
      solana/
      shared/
```

Each connector should handle:

- Authentication/signing
- Pagination
- Rate limits
- Retries/backoff
- External IDs for idempotency
- Normalization
- Error mapping
- Minimal debug metadata

Implementation defaults:

- Start with hand-rolled HTTP/API calls for the first connector.
- Use CCXT or source SDKs only after compatibility with Supabase Edge Functions
  and Deno has been proven.
- Hyperliquid, Bybit, and Coinbase should each be tested independently before
  shared connector abstractions are locked.
- On-chain v1 should support balances and basic transfers. Full DEX swap, LP,
  staking, airdrop, bridge, and protocol-level classification is a later phase.
- On-chain gas fees still need to be captured in v1 because they affect future
  cost basis and portfolio accuracy.

---

## 6. Data Storage Strategy

The Supabase free database size is the main constraint. The design must keep the
database compact.

Store permanently:

- Current source/account/wallet structure
- Current holdings
- Current derivative/perpetual positions
- Normalized portfolio events
- Trade fills
- Transfers
- Fees
- Funding payments where relevant
- FX rates used for stored calculations
- Daily total portfolio snapshots
- Daily by-source snapshots
- Daily by-asset snapshots
- Sync run history, compact
- Important sync errors, compact

Do not store permanently:

- Full raw exchange API payloads
- Full raw blockchain transaction payloads
- Tick data
- Full order books
- Large candle history
- Huge debug logs
- Screenshots or attachments unless separately planned

Retention rules:

| Data | Rule |
|---|---|
| Current holdings | Overwrite/upsert on refresh |
| Current positions | Overwrite/upsert on refresh |
| Daily total snapshots | Keep forever |
| Daily source snapshots | Keep forever |
| Daily asset snapshots | Keep forever while compact; collapse dust below chosen thresholds |
| Normalized transactions/events | Keep forever if compact |
| Raw/debug payloads | 7-30 days only, then archive/delete |
| Sync logs | Keep compact history; delete noisy old logs |
| Sync errors | Keep useful errors; archive/delete old noise |
| Backups | Export on a recurring schedule from day one |

If Supabase storage gets tight later:

1. Delete expired raw/debug payloads.
2. Compact old sync logs.
3. Archive old high-volume details to local SQLite/DuckDB/CSV/Parquet.
4. Keep Supabase as the hot/live dashboard database.

Backup baseline:

- Export financial tables regularly to compressed JSON/CSV.
- Keep backups outside the live database, such as a private GitHub repository,
  local encrypted archive, or another chosen storage target.
- Backup cadence can start weekly for v1 and move to nightly once real trading
  history is flowing.

---

## 7. Database Model Baseline

Exact columns should be finalized through migrations, but the starting model
should use these table groups.

### Identity and ownership

- `profiles`
- `user_settings`
- `audit_events`

### Source hierarchy

- `portfolio_sources`
  - exchange, chain, wallet, indexer, manual, etc.
- `source_accounts`
  - exchange sub-accounts, account types, portfolio groupings
- `source_wallets`
  - exchange wallets, on-chain wallet addresses, derivatives wallets, spot wallets

The hierarchy must support:

```txt
Exchange
  -> sub-account
    -> wallet/account type
      -> holdings

Chain
  -> wallet address
    -> holdings
```

### Assets, pricing, and FX

- `assets`
- `asset_instances`
- `asset_prices_current`
- `asset_price_snapshots_daily` only if needed later
- `fx_rates_daily`

Use two levels of asset identity:

- `assets`: canonical asset/family, such as BTC, ETH, SOL, USDC.
- `asset_instances`: source-specific or chain-specific representation, such as
  USDC on Ethereum, USDC on Solana, USDC on Base, Coinbase USDC, or Bybit USDC.

Every connector normalizes to both an asset instance and a canonical asset.
Do not rely on symbol alone for on-chain tokens.

Backend price caching owns:

- Spot prices for canonical assets.
- Source-specific prices where needed.
- Perpetual mark prices for derivative positions.
- Price provider rate limiting and fallbacks.

FX policy:

- Store native currency/value where the source provides it.
- Store derived USD and AUD values at sync time where practical.
- Store the FX rate used in `fx_rates_daily`.
- Default base display currency can be a user setting, but the schema must
  support AUD from day one because Australian tax/reporting may matter later.
- The initial FX source can be a free daily provider such as Frankfurter/ECB for
  fiat pairs, with a documented rule for prior-day close on weekends/holidays.

### Holdings

- `holdings_current`

Purpose:

- Latest known asset balance by user/source/account/wallet/asset
- Quantity
- Native value when available
- USD value
- AUD value
- Observed timestamp

This table is upserted on refresh.

### Positions

- `positions_current`

Purpose:

- Current derivative/perpetual positions by user/source/account/symbol/contract
- Side
- Size
- Entry price
- Mark price
- Margin mode
- Leverage
- Unrealized P&L
- Funding accrual where available
- Native, USD, and AUD values where practical
- Observed timestamp

Derivative positions should not be forced into `holdings_current`.

### Events and transactions

- `portfolio_events`
- `trade_fills`
- `transfers`
- `fees`
- `funding_payments`
- `cost_basis_lots`

Use compact normalized rows. Keep enough detail to reconstruct:

- Buys
- Sells
- Swaps
- Deposits
- Withdrawals
- Transfers
- Gas fees
- Exchange fees
- Funding payments
- Realized P&L later

Use `portfolio_events` as the parent event table. Child tables such as
`trade_fills`, `transfers`, `fees`, and `funding_payments` reference the parent
event. This avoids double-counting while still keeping type-specific fields.

Idempotency requirements:

- Each imported source event must have a stable provider/source external ID.
- Add unique constraints around `user_id`, `source_id`, event type, and
  `external_id` where possible.
- Fan-out retries and local sync retries must be safe to rerun.

Transfer matching:

- Cross-source transfers may appear as an outbound event from one source and an
  inbound event in another.
- The model needs a `matched_transfer_id` or equivalent grouping key so these
  pairs can be reconciled without double-counting.

The simple UI can show "asset bought, buy time, sell time, buy price, sell
price, profit/loss", but the database should not collapse complex scale-in and
scale-out behavior into one fragile row.

Use fills/events as the source of truth, then build views for:

- Average entry
- Average exit
- Partial exits
- Remaining position
- Realized P&L
- Fees

Tax and cost basis:

- Tax reporting is not part of v1 UI.
- The schema should still reserve space for cost-basis lots from day one.
- For Australia, future tax reporting likely needs per-lot accounting rather
  than only average cost.
- `cost_basis_lots` can remain inactive until the tax/reporting phase, but the
  event model must not make lot tracking impossible later.

### Snapshots

- `portfolio_snapshots_daily`
- `portfolio_snapshot_sources_daily`
- `portfolio_snapshot_assets_daily`

Snapshots should be keyed so only one snapshot per day per group is stored,
unless the user later chooses higher-frequency history.

Snapshot rows should include currency context, at minimum USD and AUD where
practical.

### Sync and reliability

- `sync_batches`
- `sync_runs`
- `sync_errors`
- `sync_cursors`
- `api_rate_limits`

These tables should answer:

- What refreshed?
- When did it refresh?
- Did it succeed?
- What failed?
- Which provider was rate-limited?
- What cursor/page/timestamp should the next sync resume from?

`sync_batches` groups one user-triggered or cron-triggered refresh. `sync_runs`
tracks each source within that batch. A batch can partially succeed.

### Backups

- `backup_exports`

This tracks export time, scope, destination, status, row counts, and error
summary for recurring backups.

---

## 8. Security Architecture

Authentication:

- Supabase Auth
- Owner email allowlist
- No public signup for personal v1
- MFA enabled for the owner account

Authorization:

- RLS enabled on every user table
- Every user table includes `user_id`
- Frontend reads/writes only what RLS allows
- Service role key used only inside server-side functions

Secrets:

- Exchange API keys go in Supabase Vault or secure function-side storage.
- Supabase service role key goes in Edge Function secrets only.
- RPC/indexer provider secrets go in Edge Function secrets or Vault.
- Frontend only receives public/publishable Supabase keys.

Exchange API key rules:

- Read-only permissions only
- Withdrawals disabled
- IP allowlisting enabled where supported and technically practical
- Separate keys per exchange/account where practical
- Rotate keys if a leak is suspected
- Never log API keys, signatures, auth headers, or raw secret values

Important IP note:

- Supabase Edge Functions on free tier should not be assumed to have static
  outbound IPs.
- IP allowlisting is therefore a best-effort rule, not a guaranteed v1 control.
- If static IP allowlisting becomes mandatory, add a fixed-egress proxy/VPS or
  change the sync deployment architecture.

Key metadata and rotation:

- Store only safe key metadata for display/debugging, such as provider, label,
  permissions, created date, and last four characters or a hash.
- Never expose the full secret after creation.
- Add a documented rotation path before real funds are connected.

Security logs:

- Track refresh requests
- Track source changes
- Track API key metadata changes
- Track failed auth/security-sensitive actions
- Track secret/key rotation actions

---

## 9. Refresh and Sync Strategy

V1:

- Manual refresh available anytime.
- Scheduled refresh a few times per day.
- Daily portfolio snapshot stored permanently.

Manual refresh:

```txt
User clicks Refresh
  -> frontend calls refresh orchestrator Edge Function
  -> orchestrator validates auth
  -> creates sync_batch
  -> resolves enabled sources
  -> invokes one per-source sync function per source
  -> each source creates/updates its own sync_run
  -> each source connector upserts holdings_current / positions_current
  -> each source connector inserts events/fills/transfers/fees idempotently
  -> each source connector updates cursors
  -> each source connector records errors if any
  -> orchestrator reconciles partial results
  -> snapshot job updates daily snapshot if needed
```

Scheduled refresh:

```txt
Supabase Cron
  -> same refresh orchestrator
  -> same per-source sync functions
  -> no duplicate logic
```

Reliability defaults:

- Retry transient failures with backoff
- Respect rate limits
- Use pagination
- Store sync cursors
- Use external IDs for idempotency
- Make partial success visible
- Do not let one bad source block all other sources
- Keep per-source try/catch isolation
- Track provider-specific API limits
- Track Supabase project pause/wake behavior as an operational risk

---

## 10. Frontend Architecture

Use React + TypeScript + Vite.

Project shape:

```txt
src/
  app/
    routes/
    providers/
    layout/
  features/
    portfolio/
      pages/
      components/
      hooks/
      api/
      types.ts
      utils.ts
      tests/
    settings/
    journal/
    research/
    finance/
  shared/
    components/
    lib/
    hooks/
    types/
    utils/
  styles/

supabase/
  functions/
  migrations/
  seed/

docs/
```

V1 should be portfolio-first. Future modules can be added as features without
changing the portfolio internals.

Frontend rules:

- Type API responses.
- Generate Supabase database types where possible with `supabase gen types`.
- Keep Supabase query logic in feature API files.
- Keep complex calculations out of components.
- Use reusable shared code only when genuinely reused.
- Avoid cross-feature coupling.
- Do not put secrets in `.env` values exposed to Vite unless they are safe public keys.

---

## 11. Testing Strategy

Use tests where they protect money, security, and sync correctness.

Vitest:

- Connector normalization
- P&L calculations
- FX conversion calculations
- Snapshot calculations
- Currency/number formatting
- Retention logic
- Idempotency helpers
- Transfer matching helpers

Playwright:

- Login path
- Portfolio page loads
- Manual refresh button behavior
- Holdings render from mocked/test data
- Error states
- Netlify preview smoke tests

Mocking strategy:

- Use canned connector responses for tests.
- Add a mock connector path before real exchange credentials are used.
- Browser tests should not require real exchange API keys.

Security checks:

- RLS policies tested before production use
- Service role key never used in frontend
- Sensitive values not logged
- Exchange key storage path reviewed

---

## 12. Deployment Flow

GitHub:

- Main branch is protected for serious tracked work.
- One Linear issue maps to one branch.
- One branch maps to one PR.

Netlify:

- Auto-deploy from `main`.
- Use deploy previews for PR review.
- Frontend build command likely `pnpm build`.
- Publish directory likely `dist`.

Supabase:

- Schema changes through migrations.
- Edge Functions deployed deliberately, not ad hoc.
- Production secrets set through Supabase secret management/Vault.
- Do not test dangerous exchange keys casually in production.
- Supabase Free does not provide a true preview database per PR.
- Use local Supabase for migration testing first; optionally use a second free
  Supabase project as staging if migration risk grows.

---

## 13. AI Build Workflow

Use this for serious multi-session work.

### Planning prompt

```txt
Inspect this repo and create a Linear project for the build.

Break the work into small Linear issues. Each issue should be independently
testable and take less than one focused session.

For each issue include:
- goal
- implementation notes
- files likely touched
- acceptance criteria
- test plan
- risk level
- security notes if relevant

Do not start coding yet. First create the project and issues.
```

### Execution prompt

```txt
Take the next Ready Linear issue.

Move it to In Progress.
Create a dedicated git branch named <linear-key>-short-description.
Implement only that issue.
Run the relevant tests.
Update the Linear issue with what changed, tests run, risks, and security notes.
Open a PR linked to the issue.
Do not merge without review.
```

### Agent rules

- Work on one issue at a time.
- Keep changes scoped.
- Do not commit directly to main.
- Do not mix unrelated refactors into feature work.
- Add security notes for secrets, auth, RLS, connectors, or financial data changes.
- Do not add dependencies without a clear reason.
- Keep PRs small enough to review.

---

## 14. Linear Issue Template

```txt
Title:

Goal:

Context:

Implementation notes:

Files likely touched:

Acceptance criteria:

Test plan:

Risk level:

Security notes:

Out of scope:
```

---

## 15. PR Template

```txt
## Summary

## Linear issue

## What changed

## Tests run

## Security notes

## Data/schema impact

## Risks / follow-ups
```

---

## 16. Free-Tier Guardrails

The project should be designed for $0/month operation.

Guardrails:

- Use Supabase Free carefully.
- Use Netlify Free for frontend hosting.
- Use GitHub Free.
- Use Linear Free unless the workflow later needs paid features.
- Use free RPC/indexer tiers where possible.
- Sync conservatively.
- Do not store high-frequency market data.
- Do not store raw API responses forever.
- Monitor database size and noisy tables.
- Expect Supabase Free projects to pause after inactivity; add a keepalive or
  accept wake-up delay for personal v1.
- Keep price API calls backend-owned and cached because free price providers can
  rate-limit quickly.

Potential future paid-risk areas:

- Heavy Ethereum/Solana indexing
- Too many scheduled syncs
- Large raw transaction payload storage
- High-frequency pricing/history
- File storage
- Multi-user/public product usage
- Static egress IP requirements for exchange allowlisting
- Perpetual mark-price data if free providers are insufficient

---

## 17. Open Decisions To Confirm Later

These do not block the architecture, but should be decided before implementation:

1. Exact initial wallet addresses.
2. Exact exchange account/sub-account list.
3. Ethereum indexer choice, likely Alchemy or similar.
4. Solana indexer choice, likely Helius or similar.
5. Price provider choice for spot assets and perpetual mark prices.
6. FX provider choice and weekend/holiday rule.
7. Initial backup destination: private GitHub repo, local encrypted archive, or another target.
8. Whether API keys are entered manually in Supabase first or managed through an in-app settings screen later.
9. Domain/subdomain.
10. Whether to add staging after v1.

No longer open:

- Database: Supabase Postgres.
- Frontend: React + TypeScript + Vite.
- Hosting: Netlify.
- Project relationship: standalone new dashboard with no connection to any existing dashboard.
- Sync architecture: per-source fan-out.
- Derivatives architecture: separate `positions_current`.
- Currency architecture: schema supports native, USD, and AUD values from day one.
- Tax architecture: `cost_basis_lots` included in schema, but tax reporting UI is phase 2.
- Asset architecture: `assets` canonical table plus `asset_instances`.
- Event architecture: `portfolio_events` parent plus child tables.
- On-chain v1 scope: balances and basic transfers, not full DEX classification.

---

## 18. Claude Second-Opinion Status

Claude Opus 4.7 reviewed the original draft on 2026-05-21. Codex then asked
Claude a follow-up review of the proposed fixes through Claude Code CLI.

Accepted changes from the Claude review:

- Keep Supabase + Netlify, but do not treat the stack itself as the cure for
  monolith problems; modular discipline is the cure.
- Make the new dashboard a standalone crypto/trading/professional system.
- Use per-source fan-out instead of a single master refresh loop.
- Build one real proof-of-concept connector before locking the connector interface.
- Treat perpetual/derivative positions as first-class with `positions_current`.
- Store native, USD, and AUD values where practical, backed by `fx_rates_daily`.
- Include `cost_basis_lots` in schema but keep tax reporting UI out of v1.
- Scope on-chain v1 to balances and basic transfers; defer full DEX/protocol classification.
- Use `assets` plus `asset_instances` for canonical and source-specific identity.
- Use `portfolio_events` parent plus child tables to avoid double-counting.
- Soften IP allowlisting because Supabase Free does not guarantee static egress IPs.
- Add backup/DR from day one.
- Backend owns price and FX caching.

Additional Claude follow-up additions:

- Add transfer matching so outbound/inbound transfers across sources can be paired.
- Capture gas fees from day one.
- Choose an explicit FX provider/policy before implementation.
- Add idempotency unique constraints for source external IDs.
- Track Supabase Free project pause/wake behavior as an operational risk.
- Ensure derivative positions use mark prices, not just spot prices.

---

## 19. Claude Final Verdict

Claude accepted the revised direction with no remaining objections to the major
architecture choices.

Accepted:

- Per-source fan-out.
- Proof-of-concept connector before abstraction.
- On-chain v1 scoped to balances and basic transfers.
- Separate `positions_current` for derivatives/perps.
- Multi-currency values and `fx_rates_daily` from day one.
- `cost_basis_lots` in schema, tax UI later.
- `assets` plus `asset_instances`.
- `portfolio_events` parent with child tables.
- Softened IP allowlisting language.
- Backend-owned price/FX caching.
- Hand-rolled first connector before SDK/CCXT decisions.
- Local sync script allowed as v0 fallback.

Final additions from Claude:

- Add transfer matching.
- Capture gas fees from day one.
- Pick an FX provider and weekend/holiday policy before implementation.
- Add source external-ID idempotency constraints.
- Track Supabase Free pause/wake behavior.
- Make derivative mark prices explicit.

---

## 20. First 10 Linear Issues Draft

1. Create project scaffold with React, TypeScript, Vite, pnpm, Vitest, Playwright.
2. Configure Netlify build and deploy preview flow.
3. Create Supabase local project structure and migration workflow.
4. Build one-source proof of concept connector end to end with safe test secrets.
5. Extract the connector interface from the proof of concept.
6. Create baseline schema: sources, accounts, wallets, assets, asset_instances, prices, FX.
7. Create portfolio schema: holdings_current, positions_current, events, child tables, snapshots.
8. Add sync schema: batches, runs, errors, cursors, idempotency constraints, rate limits.
9. Add Supabase Auth, owner-only access, RLS, and security test plan.
10. Add backup/export job and first mock/test data path.

---

## 21. Final Architecture Summary

The chosen architecture is a modular React + TypeScript frontend hosted on
Netlify, backed by Supabase Postgres/Auth/Edge Functions/Cron/Vault. The system
uses isolated per-source connectors to import exchange, wallet, derivative, and
pricing data. It normalizes that data into compact holdings, positions, parent
events, child transaction tables, FX-aware values, and daily snapshots. It
protects all financial secrets server-side, treats backups and idempotency as
first-class requirements, and uses Linear + GitHub PRs to keep AI-assisted
development auditable and maintainable.
