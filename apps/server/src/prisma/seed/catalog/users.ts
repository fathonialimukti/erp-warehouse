// Demo login roster (aetherglo.com). All human demo users share DEMO_PASSWORD,
// bcrypt-hashed in 01-access.ts with the same helper as before.
//
// Hiding rules (no schema change, no router change):
// - `AI System` is kept for background-job FK references but seeded with
//   role_id NULL + a random password, so it can never password-login and the
//   existing demoUsers/demoLogin pickers (both require roleId NOT NULL) never
//   list it.
// - There is deliberately NO `n8n` entry; 01-access.ts defensively deletes any
//   stray n8n row left by an older seed.
//
// T2 filter for the demo picker: human demo logins = role_id IS NOT NULL
// (optionally + email LIKE '%@aetherglo.com').
export const DEMO_PASSWORD = "password";

export const SEED_USERS: { email: string; name: string; role: string | null; description: string | null }[] = [
  { email: "admin@aetherglo.com", name: "Admin", role: "System Admin", description: "Full system access. Manages users, roles, settings, and every warehouse operation." },
  { email: "manager@aetherglo.com", name: "Warehouse Manager", role: "Warehouse Manager", description: "Runs the warehouse end to end. Approves transactions and reviews reports and analytics." },
  { email: "supervisor@aetherglo.com", name: "Supervisor", role: "Warehouse Supervisor", description: "Oversees the warehouse floor. Approves receiving, QC checks, and daily operations." },
  { email: "inbound@aetherglo.com", name: "Inbound Staff", role: "Receiver", description: "Handles inbound goods receiving only. Creates receipts and completes putaway tasks." },
  { email: "outbound@aetherglo.com", name: "Outbound Staff", role: "Picker", description: "Handles outbound only. Picks, packs, and dispatches shipments to customers." },
  { email: "inventory@aetherglo.com", name: "Inventory Staff", role: "Cycle Counter", description: "Looks up stock and runs cycle counts. Adjusts inventory with loss and found entries." },
  { email: "staff@aetherglo.com", name: "Staff (Viewer)", role: "Auditor", description: "Read-only overview of warehouse activity, stock levels, and reports for general staff." },
  // Background-jobs identity: NULL role + NULL description → invisible to login/demo pickers.
  { email: "ai-system@aetherglo.com", name: "AI System", role: null, description: null },
];