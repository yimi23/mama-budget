# Sources behind docs/BUDGET.md

Gathered Oct 5 2026. Items marked unverified were not reachable and come from secondary accounts.

## Products
- YNAB method and overspending: https://www.ynab.com/ynab-method, https://support.ynab.com/en_us/overspending-in-ynab-a-guide-ryWoxEyi.md
- Monarch flex budgeting (the formula and the $6,400 example): https://www.monarch.com/blog/flex-budgeting-simplify-your-spending-with-just-one-number
- Monarch vs YNAB: https://www.monarch.com/blog/how-monarch-compares-to-ynabs-zero-based-budgeting
- Copilot rollovers, rebalance, optional budgeting: https://help.copilot.money/en/articles/3790828-budget-rollovers, https://help.copilot.money/en/articles/6206302-rebalancing-your-budget, https://help.copilot.money/en/articles/6282850-optional-budgeting
- Rocket Money premium and negotiation: https://help.rocketmoney.com/en/articles/2677184-premium-membership-features, https://help.rocketmoney.com/en/articles/17141357-bill-negotiations-is-moving-to-premium
- Cleo business and pricing (Sacra): https://sacra.com/c/cleo/ ; Trustpilot: https://www.trustpilot.com/review/meetcleo.com
- Qapital rules: https://help.qapital.com/en/articles/10245399-guilty-pleasure-rule, https://help.qapital.com/en/articles/10245398-spend-less-rule, https://www.qapital.com/pricing/
- Digit / Oportun Set & Save: https://oportun.com/savings/
- Simple bank: https://en.wikipedia.org/wiki/Simple_(bank)

## Transaction engineering
- SimpleFIN protocol and developer notes: https://www.simplefin.org/protocol.html, https://beta-bridge.simplefin.org/info/developers
- Plaid transactions, recurring streams, pending to posted: https://plaid.com/docs/api/products/transactions/, https://plaid.com/docs/transactions/transactions-data/, https://plaid.com/blog/recurring-transactions/
- Plaid category taxonomy: https://plaid.com/documents/transactions-personal-finance-category-taxonomy.csv
- Plaid bank income: https://plaid.com/docs/api/products/income/
- Actual Budget schedule discovery (7.5% tolerance, six date patterns, 2-day window): https://github.com/actualbudget/actual/blob/master/packages/loot-core/src/server/schedules/find-schedules.ts
- Firefly III bills: https://github.com/firefly-iii/firefly-iii/blob/main/app/Repositories/Bill/BillRepository.php
- Ntropy recurrence: https://docs.ntropy.com/enrichment/recurrence ; Spade recurring guide: https://docs.spade.com/reference/recurring-transaction-guide
- Transfer pairing and vocabularies: https://github.com/Bubbles840/wealthfolio-simplefin-addon/blob/main/docs/superpowers/plans/2026-07-11-transfer-detection.md, https://github.com/bsaffel/moneybin/blob/main/src/moneybin/matching/transfer.py, https://github.com/Lamella-ai/lamella/blob/main/src/lamella/core/transfer_heuristic.py
- Merchant cleaning: https://github.com/lavagoapp/accountaxedvision/blob/main/src/lib/transaction-cleaner.ts, https://github.com/eburke21/spending-storyteller/blob/main/src/processing/normalizer.py, https://github.com/abdullahkhan9375/merchant-map
- Payroll detection: https://github.com/dlopez2392/prism/blob/main/src/lib/finance/income.ts

## Behavioural evidence
- Thaler 1999; Li and Feldman 2025 replication: https://doi.org/10.24072/pci.rr.100375.ar1
- Heath and Soll 1996: https://doi.org/10.1086/209465
- Soman and Cheema 2011 (envelopes, the photo): https://doi.org/10.1509/jmkr.48.SPL.S14 ; Cheema and Soman 2008 (partitions): https://doi.org/10.1509/jmkr.45.6.665
- Krishnamurthy and Prokopec 2009: https://doi.org/10.1086/649650 ; Sussman and O'Brien 2016 (earmarks push to credit): https://doi.org/10.1509/jmr.14.0455
- Sharif and Shu 2016 (emergency reserves): https://doi.org/10.1509/jmr.15.0231
- Howard et al. 2021 (expense prediction bias): https://doi.org/10.1177/00222437211068025 ; Berman et al. 2016: https://doi.org/10.1509/jmr.15.0101
- Olafsson and Pagel 2018: https://doi.org/10.1093/rfs/hhy055 ; the ostrich effect: https://www.nber.org/papers/w23945
- Hershfield, Shu and Benartzi 2020 (weekly and daily framing): https://doi.org/10.1287/mksc.2019.1177
- Dai, Milkman and Riis 2014 (fresh start): https://doi.org/10.1287/mnsc.2014.1901
- Schomburgk et al. 2024 (cashless effect meta-analysis): https://doi.org/10.1016/j.jretai.2024.05.003
- Overdraft alert RCTs, Journal of Finance 2024: https://doi.org/10.1111/jofi.13404
- Patel et al. 2016 (loss framing): https://doi.org/10.7326/M15-1635 ; Silverman and Barasch 2022 (broken streaks need repair): https://doi.org/10.1093/jcr/ucac029
- Duolingo streaks: https://blog.duolingo.com/how-duolingo-streak-builds-habit/
- Kast, Meier and Pomeranz (SMS matched peer groups): https://www.nber.org/papers/w18417 ; Breza and Chandrasekhar 2019 (a monitor): https://doi.org/10.3982/ECTA13683
- Karlan et al., Top of Mind (goal-named reminders): https://doi.org/10.1287/mnsc.2015.2296
- Gargano and Rossi 2024 (goals in a fintech app): https://doi.org/10.1111/jofi.13339
- Liebman and Mahoney 2017 (expiring budgets): https://www.aeaweb.org/articles?id=10.1257/aer.20131296 ; Gal and McShane 2012 (small victories): https://doi.org/10.1509/jmr.11.0272
- Epstein et al. 2016 (why people quit tracking): https://doi.org/10.1145/2858036.2858045
- Retention benchmarks: https://uxcam.com/blog/mobile-app-retention-benchmarks/
