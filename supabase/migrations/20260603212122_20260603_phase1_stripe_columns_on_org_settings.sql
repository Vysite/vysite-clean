/*
  # Phase 1 – Prepare org_settings for Stripe

  ## Summary
  Adds five nullable columns to org_settings to store Stripe subscription
  state. All columns are nullable so existing rows are unaffected and no
  defaults are needed — values are populated by the Stripe webhook handler
  in Phase 2.

  ## New columns on org_settings
  - stripe_customer_id      – Stripe Customer object ID (cus_...)
  - stripe_subscription_id  – Stripe Subscription object ID (sub_...)
  - plan_name               – active plan slug: 'starter' | 'professional' | 'business'
  - billing_interval        – billing cadence: 'monthly' | 'annual'
  - current_period_end      – timestamp of the current billing period end; used
                              for renewal date display in the UI

  ## Notes
  - All columns are nullable. Null means no Stripe subscription exists yet
    (trial orgs, internal orgs).
  - No existing data is modified.
  - No RLS changes — org_settings RLS policies already in place are unchanged.
*/

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text,
  ADD COLUMN IF NOT EXISTS plan_name               text,
  ADD COLUMN IF NOT EXISTS billing_interval        text,
  ADD COLUMN IF NOT EXISTS current_period_end      timestamptz;
