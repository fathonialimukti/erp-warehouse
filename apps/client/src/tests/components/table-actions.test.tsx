import { Fragment, isValidElement, type ReactNode } from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, Dropdown, Separator } from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";

/**
 * PageHeader is the only thing that feeds caller-supplied `children` into a
 * HeroUI `<ButtonGroup>`. ButtonGroup marks every *direct* child with an
 * internal `__button_group_child` prop, and React 19's client reconciler
 * rejects any prop other than `key`/`children` on a Fragment
 * (`validateFragmentProps`). The spies below let us assert PageHeader only
 * ever hands ButtonGroup plain element children.
 *
 * `react-intl` is stubbed because it ships `@types/react@18` while the app runs
 * React 19 — pulling its `ReactNode` into a type position breaks `tsc`.
 */
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage: string }) =>
      defaultMessage,
  }),
}));

interface DirectChild {
  isFragment: boolean;
  /** Props ButtonGroup would clone onto the child. */
  clonedProps: string[];
}

/**
 * `vi.mock` factories are hoisted, so the recorder must be created inside the
 * factory and read back off the mocked module — closing over a top-level
 * `let` would hit the TDZ.
 */
vi.mock("@heroui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@heroui/react")>();
  const recorder: { children: DirectChild[] } = { children: [] };
  const ButtonGroupSpy = ({ children }: { children?: ReactNode }) => {
    // `Children.map` recurses nested arrays and clones every valid element —
    // the two things that decide whether React 19 sees a Fragment carrying the
    // internal prop. Mirror that exactly.
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (!isValidElement(node)) return;
      recorder.children.push({
        isFragment: node.type === Fragment,
        clonedProps: Object.keys({ __button_group_child: true }),
      });
    };
    visit(children);
    return <div data-slot="button-group">{children}</div>;
  };
  return {
    ...actual,
    ButtonGroup: Object.assign(ButtonGroupSpy, actual.ButtonGroup),
    __buttonGroupRecorder: recorder,
  };
});

const { PageHeader } = await import("../../components/PageHeader");
const { __buttonGroupRecorder: recorder } =
  (await import("@heroui/react")) as unknown as {
    __buttonGroupRecorder: { children: DirectChild[] };
  };

const resetRecorder = () => {
  recorder.children = [];
};

/** Mirrors react-dom's `validateFragmentProps`: any non-key/children prop errors. */
const fragmentPropViolation = (child: DirectChild) =>
  child.isFragment && child.clonedProps.length > 0
    ? "__button_group_child"
    : null;

const flat = (child: ReactNode) =>
  Array.isArray(child) ? child : child == null ? [] : [child];

const render = (ui: ReactNode) => renderToStaticMarkup(<>{ui}</>);

describe("PageHeader → ButtonGroup", () => {
  it("never passes a Fragment as a direct child (React 19 `__button_group_child` crash)", () => {
    resetRecorder();
    render(
      <PageHeader title="PO-1" onBack={() => {}}>
        <>
          <Button variant="secondary">Reject</Button>
          <Button variant="primary">Approve</Button>
        </>
      </PageHeader>,
    );
    expect(recorder.children.length).toBeGreaterThan(0);
    for (const child of recorder.children) {
      expect(fragmentPropViolation(child)).toBeNull();
    }
  });

  it("flattens fragments mixed with sibling buttons and drops hidden conditionals", () => {
    const flags = [true, false];
    resetRecorder();
    render(
      <PageHeader title="PO-1" onBack={() => {}} onEdit={() => {}}>
        {flags[0] ? (
          <>
            <Button variant="secondary">Reject</Button>
            <Button variant="primary">Approve</Button>
          </>
        ) : null}
        {flags[1] ? <Button variant="secondary">Never</Button> : null}
      </PageHeader>,
    );
    // 2 from the fragment + edit + back; the `false` conditional is dropped
    expect(recorder.children).toHaveLength(4);
    for (const child of recorder.children) {
      expect(fragmentPropViolation(child)).toBeNull();
    }
  });

  it("leaves the group empty when every child is hidden", () => {
    const flags = [false];
    resetRecorder();
    render(
      <PageHeader title="PO-1" onBack={() => {}}>
        {flags[0] ? (
          <>
            <Button variant="secondary">A</Button>
            <Button variant="primary">B</Button>
          </>
        ) : null}
      </PageHeader>,
    );
    expect(recorder.children).toHaveLength(1);
  });

  it("accepts a plain button child unchanged", () => {
    resetRecorder();
    render(
      <PageHeader title="X" onBack={() => {}}>
        <Button variant="primary">New</Button>
      </PageHeader>,
    );
    expect(recorder.children).toHaveLength(2);
  });

  it("emits no console output while flattening", () => {
    resetRecorder();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <PageHeader title="PO-1" onBack={() => {}}>
        <>
          <Button variant="secondary">A</Button>
          <Button variant="primary">B</Button>
        </>
      </PageHeader>,
    );
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    error.mockRestore();
    warn.mockRestore();
  });
});

describe("row actions cell", () => {
  /** The exact composition every list page uses for its `id: "actions"` cell. */
  const actionsCell = () => (
    <Dropdown>
      <Button size="sm" variant="ghost" isIconOnly aria-label="Actions">
        <AppIcon name="menu-dots" className="size-4" />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Row actions">
          <Dropdown.Item onPress={() => {}}>
            <AppIcon name="eye" className="size-4" />
            Detail
          </Dropdown.Item>
          <Separator />
          <Dropdown.Item variant="danger" onPress={() => {}}>
            Delete
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );

  it("renders one button, not a button inside a button", () => {
    const html = render(actionsCell());
    // no <button> opens before the previous one closes
    expect(/<button[^>]*>(?:(?!<\/button>)[\s\S])*<button/.test(html)).toBe(
      false,
    );
    // the popover is closed in SSR, so the trigger must be the *only* button:
    // a nested Button would show up as a second one.
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).toContain('aria-label="Actions"');
  });

  it("does not leak the internal ButtonGroup prop into the DOM", () => {
    expect(render(actionsCell())).not.toContain("__button_group_child");
  });
});

/**
 * Guard the real sources, not just the fixture above. `Dropdown.Trigger` is
 * itself a `<button>`, so using it as a wrapper around a `Button` is exactly
 * what produced invalid DOM nesting on every row of every list page. The
 * documented patterns are a direct `Button` child of `Dropdown`, or a
 * `Dropdown.Trigger` holding non-interactive content (the Navbar avatar).
 */
describe("page sources", () => {
  const pagesDir = join(import.meta.dirname, "../../pages");
  const sources = ((): { file: string; src: string }[] => {
    const out: { file: string; src: string }[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".tsx")) {
          out.push({
            file: p.slice(pagesDir.length + 1),
            src: readFileSync(p, "utf8"),
          });
        }
      }
    };
    walk(pagesDir);
    return out;
  })();

  it("never wraps a Button in Dropdown.Trigger (button inside a button)", () => {
    const offenders = sources
      .filter(({ src }) =>
        flat(
          src.match(/<Dropdown\.Trigger>[\s\S]*?<\/Dropdown\.Trigger>/g),
        ).some((block) =>
          /<Dropdown\.Trigger>[\s\S]*?<Button[\s>]/.test(String(block)),
        ),
      )
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("keeps every row-actions Dropdown on the direct-Button pattern", () => {
    const dropdownCells = sources.filter(({ src }) =>
      src.includes('id: "actions"'),
    );
    expect(dropdownCells.length).toBeGreaterThan(0);
    for (const { file, src } of dropdownCells) {
      const cell = src.slice(src.indexOf('id: "actions"'));
      if (!cell.includes("<Dropdown>")) continue;
      expect(cell, file).not.toContain("<Dropdown.Trigger>");
    }
  });
});
