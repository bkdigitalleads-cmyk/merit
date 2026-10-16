# Merit audit (Oct 15 2026)
## Findings
1. [MED] The Target hours field can't be cleared, so typing a new goal produces the wrong number, and that number prints on the PDF
   - Where: src/screens/Settings.tsx:135-138
   - What happens: The field is controlled by settings.goalHours, and every keystroke writes `Math.max(1, Number(v) || 0) || 1`. A user on the NHS preset (25) backspaces to type 40: "25" becomes "2", then "", which is coerced to 1 and the field shows "1". Typing 4 and 0 gives "14" and then "140". The Home ring, "Goal reached" and the school PDF ("Goal: 140 hours", "18% of the 140-hour goal") all use 140.
   - Fix: keep a local text state for the input. Commit on blur/submit (parse; if empty or ≤0, revert to the previous value), the same way Given's mileage field does (commitMileage).
2. [MED] The paywall promises a free trial and "No payment now" whether or not the user is eligible for one
   - Where: src/screens/Paywall.tsx:35-41, :159, :252
   - What happens: Trial copy comes from product.introPrice, which StoreKit returns even to ineligible users, for example someone who already trialed weekly and now picks yearly in the same group. They read "you are not charged until the trial ends" and are charged at once, which leads to refunds and App Review 3.1.2 risk. The subtitle also hard-codes "Start with 3 days free" when there is no weekly trial or offerings fail to load.
   - Fix: gate trial copy on Purchases.checkTrialOrIntroductoryPriceEligibility(...) === ELIGIBLE, and remove the '3 days free' fallback.
3. [MED] Face ID lock: unsaved entries are lost on app switch, and there is no way out if Face ID or the passcode is removed or Pro lapses
   - Where: src/LockGate.tsx:342-353, :367, :376; src/screens/Settings.tsx:40-44
   - What happens: (a) When the app backgrounds, LockGate renders the lock screen instead of its children, which unmounts EntryFormModal. After unlocking, the form remounts and reset() runs, so an entry half-typed before checking a text from the coordinator is gone. (b) If the user removes their device passcode, authenticateAsync fails forever, the app is stuck on the lock screen, and deleting the app is the only escape, which erases the log. (c) After Pro lapses, the lock can't be turned off because the toggle opens the paywall.
   - Fix: render the lock as an absolute-fill overlay above mounted children. In unlock(), when the error is not_enrolled / passcode_not_set / not_available, disable the lock. Only require Pro when turning the lock on.
4. [LOW] PDF Hours column doesn't add up to the Total row
   - Where: src/report.ts:65 vs :125 (fmtDecimalHours, src/db.ts:222-225)
   - What happens: Each row is rounded to 2 decimals separately, but the total is computed from the exact minutes. Three 20-minute entries print as 0.33, 0.33 and 0.33 with a Total of 1. A coordinator who adds up the column gets 0.99 and questions the log.
   - Fix: print rows in h:mm (fmtHours), or compute the total from the rounded row values.
5. [LOW] Save errors are silent
   - Where: src/screens/EntryForm.tsx:172-196 (try/finally with no catch)
   - What happens: If insertEntry/updateEntry throws (disk full, DB locked), the promise rejection goes unhandled, the Save button comes back, and the user gets no message.
   - Fix: add `catch (e) { Alert.alert('Could not save', e?.message ?? 'Please try again.') }` as in Given.
6. [LOW] A purchase that succeeds without granting 'pro' shows nothing
   - Where: src/screens/Paywall.tsx:75-81
   - What happens: ok:true with isPro:false (a product not attached to the entitlement) runs neither branch, so the user has paid and the paywall stays open with no message. Nothing in the app calls refreshPro or registers a CustomerInfo listener.
   - Fix: add an `else if (res.ok)` alert pointing to Restore, and add Purchases.addCustomerInfoUpdateListener in state.tsx.
7. [LOW] The Face ID system prompt says "Unlock your journal" (left over from the engine fork)
   - Where: src/LockGate.tsx:24
   - What happens: The iOS Face ID sheet in a volunteer-hours app reads "Unlock your journal".
   - Fix: change it to 'Unlock your hours log'.

## Checked and fine
- db.ts schema is unchanged since the first commit, so there are no migration gaps. Duration is stored as integer minutes, and totals and stats are SQL SUMs.
- Decimal hours to minutes (parseHoursToMin, with "," accepted) round-trips cleanly through edit (2-decimal hours gives the same minutes). Timer elapsed minutes have a minimum of 1 and persist in AsyncStorage across app restarts.
- Dates are local YYYY-MM-DD (no toISOString). Forward date stepping is capped at today.
- Free limit (10 entries) is enforced at the only add entry point. PDF and CSV are Pro-gated.
- Restore (Settings and paywall) handles the ok / not-found / error cases. Onboarding skips the paywall for users who are already Pro. Settings JSON.parse is guarded.
- Goal presets (NHS 25, school 40, college 100, scholarship 50) are suggestions and editable. pct has a guard against division by zero.
- The review prompt fires once after the first entry or first export, with an AsyncStorage flag and hasAction guard.
- CSV quoting is correct. Hours use toFixed(2).
