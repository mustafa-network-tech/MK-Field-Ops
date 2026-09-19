# Paid signup disabled

There is no verified payment integration. Both Edge functions, Vercel routes,
the proxy, shared activation helpers, and client paid signup reject all requests.
No environment variable or secret enables mock activation.

Do not restore the old mock flow or send secrets through VITE_* variables.
A future payment integration must verify provider signatures server-side,
validate amount/currency/product and event idempotency before provisioning.

Existing deployed Edge functions remain unchanged until an explicitly authorized
release replaces them. A Vercel-only release does not disable old Edge endpoints.
Review the security migration and staging tests before release. Do not run legacy
RUN_ALL_MIGRATIONS_ONE_GO.sql as a replacement for ordered migrations.
