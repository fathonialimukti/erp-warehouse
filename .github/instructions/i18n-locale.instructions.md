---
description: "Use when adding or editing i18n locale keys in en.json or id.json, writing intl.formatMessage() calls, or translating UI strings. Covers the key naming convention, required keys per page type, and both locale files."
applyTo: "apps/client/src/locales/**"
---

# i18n Locale Key Conventions

## Key Naming Pattern

```
{domain}.{page}.{key}
```

| Segment | Rule | Example |
|---------|------|---------|
| `{domain}` | `snake_case` domain name | `warehouse`, `inbound_transaction` |
| `{page}` | `index` / `detail` / `form` | `index`, `detail`, `form` |
| `{key}` | `snake_case` descriptor | `title`, `header_name`, `action_create` |

**Nav keys** use `nav.{section}` — no domain prefix:
```
nav.dashboard, nav.warehouse, nav.skus, nav.access_control
```

**Common/shared keys** use `common.{category}.{key}`:
```
common.action.edit, common.action.delete, common.action.cancel, common.action.confirm
common.modal.confirm_delete_title, common.modal.processing, common.modal.success, common.modal.error
common.search.placeholder
```

## Required Keys Per Page Type

### Index page (`{domain}.index.*`)
```
{domain}.index.title               — Page heading
{domain}.index.description         — Optional subtitle / description
{domain}.index.search_placeholder  — Search input placeholder
{domain}.index.create_button       — Primary create button label
{domain}.index.header_{field}      — One entry per table column
{domain}.index.empty_state         — Empty table message
{domain}.index.loading             — Loading state text
{domain}.index.action_delete       — Delete action label
{domain}.index.delete_confirm_body — Delete confirmation message body
```

### Detail page (`{domain}.detail.*`)
```
{domain}.detail.loading_detail     — Loading state text
{domain}.detail.not_found          — Not found error message
{domain}.detail.back               — Back button label
{domain}.detail.{field}_label      — One entry per displayed field label
{domain}.detail.delete_confirm_body — Delete confirmation message body
```

### Form page (`{domain}.form.*`)
```
{domain}.form.title_create         — Page title when creating
{domain}.form.title_edit           — Page title when editing
{domain}.form.field_{field}        — One entry per form field label
{domain}.form.success.created      — Success message after create
{domain}.form.success.updated      — Success message after update
{domain}.form.error.create_failed  — Error message on create failure
{domain}.form.error.update_failed  — Error message on update failure
{domain}.form.errors.no_permission — Permission denied message
{domain}.form.modal.confirm_title  — Confirm modal header
{domain}.form.modal.confirm_body   — Confirm modal body text
```

## Rules

- Always add keys to **both** `en.json` and `id.json` at the same time.
- Keep keys sorted alphabetically within each domain block.
- `defaultMessage` in `intl.formatMessage()` must match the English value — it's the fallback.
- For keys with dynamic values, use ICU message format: `"Delete \"{name}\"?"` with `{ name: record.name }` as the values argument.
- Never hardcode user-visible strings in components — every string must have a locale key.
