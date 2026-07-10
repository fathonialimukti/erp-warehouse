---
description: "Implement a professional ERP feature in this workspace using the ERP 3D HeroUI Builder agent. Use for new screens, CRUD flows, dashboard modules, admin tools, tRPC-connected UI, or 3D warehouse interactions."
name: "ERP Feature"
argument-hint: "Describe the ERP feature, user role, data flow, and whether 3D interaction is needed"
agent: "ERP 3D HeroUI Builder"
---
Implement the ERP feature described in the user's request.

Requirements:
- Follow existing workspace architecture, routes, permissions, locale handling, tRPC patterns, and Prisma usage.
- Prefer HeroUI v3 components and compound APIs for interface work.
- Use HeroUI props, variants, slots, and composition only. Do not use `className` or `classNames` on HeroUI components.
- If 3D interaction is required, use the local React Three Fiber skills and keep the scene task-oriented.
- Read existing files before editing and keep the solution consistent with current patterns.
- Make the result feel like a professional ERP application rather than a demo UI.

Expected output:
- Brief implementation plan for non-trivial work
- Direct code changes
- Short summary of what changed, how it was verified, and any remaining risk