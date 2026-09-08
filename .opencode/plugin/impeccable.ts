import { join } from "node:path"
import type { Plugin } from "@opencode-ai/plugin"

const EDIT_TOOLS = new Set(["edit", "write", "apply_patch"])

export const ImpeccableHook: Plugin = async ({ worktree }) => {
  const script = join(worktree, ".agents", "skills", "impeccable", "scripts", "hook.mjs")

  // Port of the Copilot hook guard: only run when Node 22 is available.
  const node22 = await Bun.spawn(
    ["node", "-e", "process.exit(parseInt(process.versions.node,10)===22?0:1)"],
    { stdout: "ignore", stderr: "ignore", stdin: "ignore" },
  ).exited.then((code) => code === 0).catch(() => false)

  return {
    "tool.execute.after": async (input, output) => {
      if (!node22) return
      if (!EDIT_TOOLS.has(input.tool)) return
      try {
        const proc = Bun.spawn(["node", script], {
          cwd: worktree,
          stdin: "pipe",
          stdout: "pipe",
          stderr: "ignore",
          signal: AbortSignal.timeout(5000),
        })
        proc.stdin.write(
          JSON.stringify({
            hook_event_name: "PostToolUse",
            tool_name: input.tool,
            tool_input: output.args ?? {},
            cwd: worktree,
          }),
        )
        proc.stdin.end()
        await proc.exited
      } catch {
        // Contract: never break the agent's turn.
      }
    },
  }
}
