# KKV CRM follow-up approval es reporting

1. Approval callback / pause / resume felület összekötése.
2. Napi summary aggregálás és publikálás.
3. Audit log bekötése a manualis döntésekhez.
4. Staging szintu ellenőrzés a külön approval/reporting láncra.

## Első implementacios lepés

- Először az approval control surface készül el, mert erre épül a summary és az audit visszakereshetősége.

Kimenet: a routing slice fut, az approval/reporting külön, szűk trackben fejeződik be.
