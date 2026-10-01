# PA family access architecture (design; not implemented)

Initial users: owner and wife. Additional family members may be invited individually later. Brother's independent PA installation is separate unless explicitly changed.

- One PA WhatsApp Business number; each family member chats from their own verified WhatsApp account. Never use the inbound sender number alone to grant privileged actions without enrollment and re-verification safeguards.
- Each member connects their own Gmail via individual OAuth authorization. Never reuse another member's tokens. Notifications and complete outgoing draft approvals go only to the corresponding authorized member; email sending requires that member's explicit approval.
- One PA application and logical storage infrastructure; private documents and Gmail content are scoped to owner identity, and explicitly shared family documents have an access-control list. Google Drive folder sharing alone is not sufficient authorization for PA retrieval.
- Database: introduce users, verified identities, connected accounts, document owners, document access grants and per-user audit entries after reviewing the existing Supabase schema and RLS. Default-deny all cross-user access; apply authorization in API and database queries, including search, AI retrieval, previews and generated summaries.
- Shared files must be deliberately designated shared; no automatic sharing of Gmail attachments. Separate personal reminders and shared reminders. Revocation must remove access to future retrieval and invalidate cached results.
- Do not enable multi-user access until authorization, consent, data segregation, logging, deletion and adversarial cross-account tests pass.
- Current webhook remains a test-only implementation, not a production AI assistant. Meta publication and live number setup remain separate prerequisites.
