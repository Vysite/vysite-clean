## Production release — checklist

**From branch:** `staging`
**To branch:** `main`

> This PR deploys to app.vysite.com. It must not be merged until every item below is checked.

### Release summary
<!-- What is included in this release? One sentence per change. -->

### Staging sign-off (must be complete before this PR is opened)
- [ ] All changes in this PR have been live on staging.vysite.com
- [ ] Login / logout verified on staging
- [ ] Session persistence verified on staging
- [ ] All changed modules tested end-to-end on staging
- [ ] AI Tender Assistant tested on staging (if applicable)
- [ ] PDF / export outputs verified on staging (if applicable)
- [ ] Mobile layout verified on staging (if applicable)
- [ ] No browser console errors on staging
- [ ] `npm run typecheck` passes clean
- [ ] `npm run build:production` completes without errors

### Database / migrations
- [ ] No schema changes in this PR  
  — OR —
- [ ] Migration has been applied to the production Supabase project manually before this PR merges

### Environment variables
- [ ] No new `VITE_*` variables introduced  
  — OR —
- [ ] New variables have been added to Vercel Production scope before this PR merges

### Post-merge verification (complete within 10 minutes of merge)
- [ ] Vercel production build completed successfully
- [ ] app.vysite.com loads without errors
- [ ] Login works on app.vysite.com
- [ ] No amber staging banner visible on production
- [ ] `VITE_APP_VERSION` bumped in Vercel Production env vars if this is a named release

### Rollback plan
<!-- If something goes wrong, what is the rollback step? -->
<!-- e.g. "Revert this PR and trigger a Vercel redeploy of the previous main commit" -->

### Reviewer sign-off
- [ ] Reviewed by: @<!-- GitHub username -->
- [ ] Approved and ready to merge
