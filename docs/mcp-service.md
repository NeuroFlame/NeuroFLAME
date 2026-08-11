# NeuroFLAME MCP service

NeuroFLAME exposes an optional, user-authorized Model Context Protocol (MCP)
endpoint at `/mcp`. It is intended for agent-assisted management of consortia,
study configuration, and runs. MCP is disabled for every user by default.

## Privacy boundary

The management tools expose only data already held by the central API. They do
not expose participant datasets, subject identifiers, dataset mount paths,
participant-local computation parameters, provisioned run kits, container
output, local diagnostic logs, or raw computation errors. Shared run errors
remain the same sanitized messages shown by the NeuroFLAME application.

Anything returned by an MCP tool leaves NeuroFLAME and is available to the MCP
client and its configured model provider. It may consequently be retained in a
chat or provider log. Do not place PHI in consortium titles, descriptions,
leader notes, global computation parameters, usernames, or other centrally
shared metadata.

Participant-local source data is outside the MCP surface by design. A separate,
off-by-default setting permits serialization of the deidentified derivatives
already exposed by the authenticated user's NeuroFLAME Results page. It does
not grant access to datasets, source subject records, dataset paths, local
configuration, run kits, container output, or diagnostic logs.

Derivative result requests are relayed to the signed-in desktop client and held
in central process memory only until the requesting MCP call completes or times
out. The serializer supports:

- inactive visible text from the Results page `index.html`, with up to four
  referenced PNG, JPEG, or WebP figures;
- UTF-8 text, MATLAB source, Markdown, CSV, JSON, or HTML files up to 1 MiB;
- PNG, JPEG, or WebP figures up to 5 MiB; and
- a bounded list of relative derivative filenames shown by the Results page.

Only the authenticated user's result directory for the requested run is
eligible. Symlinks, traversal, dotfiles, log files, the local error marker,
absolute paths, and unsupported binary formats are rejected. Computation
authors and deployment operators are responsible for ensuring the Results-page
derivative contract remains deidentified.
The desktop serializer requires operating-system no-follow and directory-handle
semantics and fails closed when the packaged platform cannot provide them.

## User authorization

Open **User Settings → Agent access (MCP)** in the desktop application.

1. Enable MCP for the account.
2. Give the displayed endpoint to an MCP client that supports remote Streamable
   HTTP servers and OAuth.
3. Complete the browser authorization prompt using the NeuroFLAME account.
4. Keep the NeuroFLAME User Settings page open when requesting a write. Every
   mutation creates a two-minute request containing a structured preview of
   every central value being changed and an exact-operation fingerprint. Long
   previews are explicitly truncated with their length and SHA-256 digest, with
   the complete value available to expand before approval; invite tokens are
   never displayed. Approve or deny it in NeuroFLAME; an MCP
   client's own elicitation response cannot authorize the change.

The settings page lists connected clients. A user can revoke one connection or
disable MCP to revoke all connections. OAuth uses authorization code flow with
PKCE (`S256`), dynamically registered clients, audience-bound opaque bearer
tokens, rotating refresh tokens, and the scopes `neuroflame:read` and
`neuroflame:write`. Derivative result tools additionally require
`neuroflame:results` and the separate account setting.
An authorization request that omits `scope` receives read access only. Write
and derivative-result access must always be requested explicitly.

## Tool surface

Read tools cover the authenticated profile, accessible consortia, computation
metadata, run state and sanitized errors, and leader-visible vault metadata.
Management tools cover:

- creating and editing consortia;
- inviting a human member by email, joining, or leaving;
- setting participant active and ready state;
- selecting a computation and setting global parameters or leader notes;
- starting a run; and
- leader member and hosted-vault management.

Human users are not directly inserted by username. They receive an email invite
and accept it through the existing invitation flow. Existing GraphQL
authorization remains authoritative for every tool; MCP does not grant new
consortium or administrator privileges.

When derivative access is enabled, result tools serialize the default report,
list the derivative files visible on the Results page, or serialize one
supported derivative file. The desktop client must be online and signed in as
the run participant.

## Hosting configuration

Set the following central API environment variables:

| Variable | Meaning |
| --- | --- |
| `MCP_PUBLIC_URL` | Public absolute MCP resource URL, for example `https://neuroflame.example.org/mcp`. |
| `MCP_ALLOWED_ORIGINS` | Optional comma-separated additional browser origins allowed to call the MCP endpoint. |
| `MCP_TRUST_PROXY` | Optional exact reverse-proxy hop count (`1`–`5`) or comma-separated bounded proxy CIDRs such as `10.20.0.0/24`. Configure this to match the actual TLS proxy path so authorization throttles use the real client address. Never use an all-address range. |

When using a hop count, the central API must not be directly reachable around
that fixed proxy chain. CIDR mode should name only the actual proxy network.

Production deployments must use HTTPS. The public URL's origin is also the
OAuth issuer, so the reverse proxy must route `/mcp`, `/authorize`, `/token`,
`/register`, `/revoke`, `/oauth/approve`, `/.well-known/oauth-authorization-server`,
and `/.well-known/oauth-protected-resource/mcp` to the same central API service.
Route `/mcp-relay/*` to that service as well.
Preserve `Authorization`, `Origin`, `Mcp-Session-Id`, and streaming response
headers. Do not add request or response body logging for these routes.
The desktop edge client's configured central `httpUrl` must use the same public
origin as `MCP_PUBLIC_URL`; the edge client rejects callbacks to any other
origin.
Apply deployment-level rate limits to dynamic registration, authorization,
approval, and token routes without recording credentials or request bodies.
The application also limits password attempts and concurrent/repeated result
relay requests. If the API is behind a reverse proxy, keep Express's effective
client address trustworthy when applying additional proxy-level limits.

MCP sessions, GraphQL subscription delivery, and pending derivative callbacks
are currently process-local. Run one central API process for MCP deployments.
Supporting multiple central API replicas will require shared session, PubSub,
and pending-request infrastructure throughout NeuroFLAME.

The central API stores registered OAuth clients, hashed authorization codes,
and hashed access/refresh tokens in MongoDB. Authorization codes expire after
five minutes, access tokens after fifteen minutes, and refresh grants after
an absolute thirty-day family lifetime. Spent refresh-token hashes are retained
for that lifetime; replay revokes the entire family and its pending operations.
Inactive MCP sessions are closed after thirty minutes as new MCP
traffic is handled, with at most ten active sessions per user. Connection IDs
remain stable while refresh credentials rotate atomically. Disabling MCP
increments the account authorization epoch so credentials issued by a racing
request cannot become valid after MCP is re-enabled. Derivative relay requests
and their one-time credentials expire after thirty seconds.
