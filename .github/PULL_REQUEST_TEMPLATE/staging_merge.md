## Staging merge — checklist

**From branch:** `develop` (or feature branch)
**To branch:** `staging`

### What does this PR include?
<!-- Brief description of changes being promoted to staging -->

### Pre-merge checks
- [ ] `npm run typecheck` passes locally with no errors
- [ ] `npm run build:staging` completes without errors
- [ ] No console errors in the browser on a local build
- [ ] No `.env` files or secrets included in this PR

### Staging validation (complete after merge and Vercel redeploy)
- [ ] Login / logout works on staging.vysite.com
- [ ] Session persists after page refresh
- [ ] Core flows tested (create, edit, delete) for changed modules
- [ ] AI Tender Assistant tested if AI code was changed
- [ ] PDF / export tested if report code was changed
- [ ] Mobile layout checked if UI was changed
- [ ] Amber "STAGING" banner is visible — confirms correct environment
- [ ] No unexpected errors in browser console

### Notes
<!-- Anything the reviewer or tester should know -->
