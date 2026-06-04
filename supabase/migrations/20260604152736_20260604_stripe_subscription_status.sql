/*
  # Add subscription_status to org_settings

  ## Summary
  Adds a subscription_status column to org_settings to track the live Stripe
  subscription state independently from account_type. This allows the app to
  distinguish between active paid accounts, accounts with failed payments
  (past_due), and cancelled subscriptions without losing the account record.

  ## New column
  - `subscription_status` (text, nullable)
    Mirrors Stripe's subscription.status field:
    null         = no Stripe subscription (trial or internal)
    'active'     = subscription current and paid
    'past_due'   = payment failed, subscription still alive (Stripe retrying)
    'canceled'   = subscription was cancelled
    'unpaid'     = all payment retries exhausted

  ## Notes
  - Null is intentional for trial orgs — they have no Stripe subscription.
  - 'past_due' shows a payment warning banner but does NOT lock the account
    immediately; Stripe retries automatically.
  - 'canceled' and 'unpaid' lock the account with a suitable re-subscribe CTA.
  - No existing rows are modified.
*/

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS subscription_status text;
