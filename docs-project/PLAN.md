# Civic Register SaaS — Concept Plan

**RameTech Consultancy · created 26 Sep 2026 · status: design (diagrams approved pending)**

One product, many institutions. Productize the zonal-council register system into a
multi-tenant platform: any district assembly, council, or institution signs up, brands
its instance (logo, colours, name, subdomain), adds its own KoBoCollect-style form
fields, and gets an isolated, secured database — for **GHS 4,000 per year (~US$345,
1 USD ≈ 11.6 GHS)**.

**Revenue model (confirmed):** flat price, volume game — "more hold more". The more
institutions signed, the more revenue; no per-size tiers.

**Hosting (confirmed):** fully hosted by RameTech — one Next.js app on Vercel, one
isolated Neon Postgres database created per tenant at signup, sealed with Postgres RLS.
Clients just log in; updates ship to everyone at once.

## Confirmed decisions

| Decision | Choice |
|---|---|
| Fee | GHS 4,000 / institution / year, Paystack (MoMo or card) |
| Pricing shape | Flat — volume, not tiers |
| Customization | Branding + custom form fields (KoBo-style, officer-defined) |
| Hosting | Single multi-tenant app; per-tenant isolated Neon DB |
| Trial | 14 days full features; unpaid → read-only lock, data kept |

## Diagrams (in `diagrams/`, each with PNG preview)

1. `01-architecture.html` — Multi-tenant architecture: tenant instances → SaaS core
   (tenant router, RLS, branding engine, custom fields, printable bills) → per-tenant
   Neon databases + Paystack billing.
2. `02-onboarding.html` — Signup → brand → custom fields → auto-provision →
   GHS 4,000 decision → live (or 14-day trial → paid).
3. `03-data-model.html` — 7 entities: control plane (Tenant, Subscription, Payment)
   in platform DB; tenant plane (User, FormDef, CustomField, Entry) per tenant DB;
   `entry.data` JSONB carries each tenant's custom fields.

## Revenue math (flat GHS 4,000/yr)

| Tenants signed | Gross / yr | ≈ USD / yr |
|---|---|---|
| 5 | GHS 20,000 | ~$1,720 |
| 10 | GHS 40,000 | ~$3,450 |
| 20 | GHS 80,000 | ~$6,900 |
| 50 | GHS 200,000 | ~$17,240 |

Cost base: Vercel Pro + Neon scale + Paystack fees (~1.95% local) scale with tenants,
so margin per tenant stays roughly constant — volume is pure upside.

## Notes

- Anonymity rule applies: no Dickson/RAMEDIC identity in the client bundle.
- Existing 8 zonal-council deployments remain as-is; this platform is the *product*
  that future councils/institutions buy into. NJSMA could later be migrated as
  tenant #1 as a live showcase.
- Next step after diagram approval: spec → implementation plan (OpenSpec SDD per
  Dickson's standing preference) → build vertical slice.