# Venn2Meet Manual E2E Checklist

- [ ] Deploy latest branch to a Workers URL.
- [ ] Open `/` and create an event with valid range + granularity.
- [ ] Confirm redirect to `/e/:token` and grid renders.
- [ ] Open same link in second browser profile and ensure submitted N updates after first sync.
- [ ] Verify drag-select on desktop updates my-time immediately.
- [ ] Verify touch selection on mobile viewport (or device emulation) updates my-time.
- [ ] Confirm legend lists Perfect, Near-perfect, Only missing me, and My time.
- [ ] Trigger empty intersection and confirm guidance message appears.
- [ ] Verify API reads (`GET /api/events/:token/grid`) contain only `n`, `slots`, and `mine`.
- [ ] Confirm failed sync state shows retry-oriented copy.
