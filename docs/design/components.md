# Component Catalog

HeroUI v3 compound components used across the ERP Warehouse UI. All
components are imported from `@heroui/react`.

## Layout

| Component | Usage |
|---|---|
| `PageHeader` | Page title + subtitle + action buttons |
| `PageSection` | Grouped content block with title |
| `DataTable` | Sortable, filterable, paginated data tables |
| `EmptyState` | No-data illustration with action |
| `LoadingState` | Skeleton-based loading indicator |

## Forms

| Component | Usage |
|---|---|
| `Button` | Primary, secondary, danger, icon-only variants |
| `Input` | Text fields, number inputs, text areas |
| `Select` | Dropdown selects (warehouse, SKU, supplier) |
| `SelectSearch` | Async search selects (SKU by code, user by email) |
| `Checkbox` | Binary toggles |
| `Switch` | Settings toggles |
| `Textarea` | Multi-line text (notes, addresses) |
| `NumberField` | Quantity inputs with increment/decrement |
| `DateField` | Date pickers (transaction dates) |
| `DatePicker` | Calendar date selection |
| `Form` | Form layout with validation summary |

## Feedback

| Component | Usage |
|---|---|
| `Modal` | Confirmation dialogs, form modals (AI Fill) |
| `Modal.Header` | Modal title + close button |
| `Modal.Body` | Modal content |
| `Modal/Footer` | Modal actions |
| `Dropdown` | Row action menus (view, edit, delete, approve) |
| `Popover` | Popover content (filter chips, tooltips) |
| `Tooltip` | Icon help text |
| `Toast` | Transient notifications |
| `Alert` | Inline banners (error, warning, success) |
| `Spinner` | Loading spinners |
| `Skeleton` | Content placeholders |

## Data Display

| Component | Usage |
|---|---|
| `Table` | Data tables (used inside `DataTable`) |
| `Pagination` | Page navigation |
| `Tabs` | Tabbed views (inbound/outbound transaction hubs) |
| `Breadcrumb` | Navigation hierarchy |
| `Avatar` | User initials in header |
| `Badge` | Status badges (approved, pending, rejected) |
| `Chip` | Filter chips, removable tags |
| `Card` | KPI cards, detail summary cards |
| `Card.Header` | Card title area |
| `Card.Content` | Card body |
| `Card.Footer` | Card actions |

## Compound Patterns

### Page layout

```
<PageHeader title="Receiving" subtitle="Inbound transactions" />
<PageSection>
  <DataTable ... />
</PageSection>
```

### Detail page

```
<Card>
  <Card.Header>Summary</Card.Header>
  <Card.Content>
    <KPI row>
      <KPI label="Total Items" value="..." />
      <KPI label="Status" value="..." />
    </KPI row>
  </Card.Content>
</Card>
<Card>
  <Card.Header>Items</Card.Header>
  <Card.Content>
    <Table>...</Table>
  </Card.Content>
</Card>
```

### Row actions

```
<Dropdown>
  <Dropdown.Trigger>
    <Button isIconOnly>⋯</Button>
  </Dropdown.Trigger>
  <Dropdown.Menu>
    <Dropdown.Item key="detail">Detail</Dropdown.Item>
    <Dropdown.Item key="edit">Edit</Dropdown.Item>
    <Dropdown.Item key="delete" className="text-danger">Delete</Dropdown.Item>
  </Dropdown.Menu>
</Dropdown>
```

## Known Issues

- **HeroUI `Select.Popover` + `ListBox`** doesn't render options in headless
  Chromium (portal rendering issue). Workaround: use `SelectSearch` with
  async search, or test with `headed` mode. See
  `apps/client/src/tests/e2e/shipment.spec.ts`.
