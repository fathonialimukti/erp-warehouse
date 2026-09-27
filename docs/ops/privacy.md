# Privacy & Data Protection

## Data We Collect

The ERP Warehouse stores business data entered by warehouse operators and
managers. This includes:

- **Master data**: Products, SKUs, suppliers, warehouses, storage locations,
  pallets
- **Transactional data**: Receiving, putaway, picking, dispatch, returns,
  disposals, losses, WIP, transfers, purchase orders
- **User data**: Names, email addresses, role assignments, password hashes
- **System data**: Activity logs, system logs, notification records

## Data Retention

| Data Type | Retention | Rationale |
|---|---|---|
| Transaction records | 7 years | Financial compliance (tax, audit) |
| Activity logs | 1 year | Operational visibility |
| System logs | 90 days | Debugging, performance |
| User accounts | Indefinite | Access control baseline |
| Backup archives | 30 days | Disaster recovery |

Retention is configurable under **System → Settings → Logging** (system
logs) and **System → Settings → Backup** (backup archives).

## Data Access

- **Role-based**: Access is gated by `resource@action` permissions
- **Audit trail**: Every transaction records who created/modified it and when
- **Activity logs**: All user actions are logged with timestamp, IP, and action

## Data Security

- **Encryption at rest**: PostgreSQL connection is TLS-enabled; backups are
  AES-256-GCM encrypted
- **Encryption in transit**: TLS 1.2+ for all HTTP traffic; JWT cookies are
  `HttpOnly` and `SameSite=Lax`
- **Password hashing**: bcrypt (cost factor 12)
- **Secrets management**: `JWT_SECRET` and other secrets are environment
  variables, never committed to version control

## Your Rights

If you are a user in this system, you have the right to:
- Request a copy of your personal data
- Request correction of inaccurate data
- Request deletion of your account (subject to audit trail requirements)

Contact the system administrator to exercise these rights.

## Compliance

This system is designed to support:
- **GDPR** — data minimization, retention limits, access controls, audit trails
- **SOX** — separation of duties, immutable audit trail, approval workflows
- **ISO 27001** — access control, encryption, incident response

## Contact

For privacy questions or data access requests, contact the system
administrator via the repository's security contact.
