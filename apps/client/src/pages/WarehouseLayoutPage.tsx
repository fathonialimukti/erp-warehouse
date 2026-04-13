import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Card,
  Button,
  Switch,
  Input,
  Chip,
  Select,
  Label,
  ListBox,
  TextField,
} from '@heroui/react';
import {
  WarehouseScene,
  type WarehouseDataSourceMode,
  type WarehouseSceneDiagnostics,
} from '../components/WarehouseScene';

export default function WarehouseLayoutPage() {
  const intl = useIntl();
  const [showGrid, setShowGrid] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dataSource, setDataSource] = useState<WarehouseDataSourceMode>('mock');
  const [warehouseId, setWarehouseId] = useState('');
  const [diagnostics, setDiagnostics] = useState<WarehouseSceneDiagnostics>({
    totalPalletPlaceholders: 0,
    totalFloorPlaceholders: 0,
    sourcePalletRows: 0,
    renderedPallets: 0,
    missingPlaceholderRows: 0,
    missingModelRows: 0,
  });
  const coverageRate = diagnostics.sourcePalletRows > 0
    ? Math.round((diagnostics.renderedPallets / diagnostics.sourcePalletRows) * 100)
    : 0;

  const handleFullscreen = () => {
    if (!isFullscreen) {
      const elem = document.getElementById('warehouse-viewer');
      if (elem?.requestFullscreen) {
        elem.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-700">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        <Card.Header className="relative flex-col items-start gap-2 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            {intl.formatMessage({ id: 'warehouseLayout.sectionTitle', defaultMessage: 'Warehouse Operations' })}
          </p>
          <Card.Title className="text-3xl tracking-tight text-white md:text-4xl">
            {intl.formatMessage({ id: 'warehouseLayout.pageTitle', defaultMessage: 'Warehouse Layout 3D' })}
          </Card.Title>
          <Card.Description className="max-w-3xl text-sm text-slate-300 md:text-base">
            {intl.formatMessage({
              id: 'warehouseLayout.pageDescription',
              defaultMessage:
                'Data-driven visualization with runtime mapping from pallet placeholders into active pallet records. Validate mapping in mock mode, then switch to live warehouse data.',
            })}
          </Card.Description>
        </Card.Header>
        <Card.Content className="relative px-6 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="soft" color="success">
              {dataSource === 'mock'
                ? intl.formatMessage({ id: 'warehouseLayout.mockValidation', defaultMessage: 'Mock Validation' })
                : intl.formatMessage({ id: 'warehouseLayout.liveOperations', defaultMessage: 'Live Operations' })}
            </Chip>
            <Chip size="sm" variant="soft" color="accent">
              {intl.formatMessage({ id: 'warehouseLayout.renderedCount', defaultMessage: 'Rendered {count}' }, { count: diagnostics.renderedPallets })}
            </Chip>
            <Chip size="sm" variant="soft" color={coverageRate >= 95 ? 'success' : 'warning'}>
              {intl.formatMessage({ id: 'warehouseLayout.coveragePercent', defaultMessage: 'Coverage {percent}%' }, { percent: coverageRate })}
            </Chip>
          </div>
        </Card.Content>
      </Card>

      {/* Controls */}
      <Card className="border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <Card.Header className="p-6 pb-3">
          <Card.Title>{intl.formatMessage({ id: 'warehouseLayout.controlsTitle', defaultMessage: 'Controls' })}</Card.Title>
          <Card.Description>
            {intl.formatMessage({ id: 'warehouseLayout.controlsDescription', defaultMessage: 'Select source mode, configure warehouse ID, and inspect mapping quality.' })}
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-5 px-6 pb-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div className="flex items-center gap-3">
              <Switch
                isSelected={showGrid}
                onChange={setShowGrid}
                aria-label={intl.formatMessage({ id: 'warehouseLayout.toggleGridAria', defaultMessage: 'Toggle grid' })}
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {intl.formatMessage({ id: 'warehouseLayout.showGridLabel', defaultMessage: 'Show Grid Floor' })}
              </label>
            </div>

            <div className="space-y-1">
              <Label>{intl.formatMessage({ id: 'warehouseLayout.dataSourceLabel', defaultMessage: 'Data Source' })}</Label>
              <Select
                selectedKey={dataSource}
                onSelectionChange={(key) => setDataSource(key as WarehouseDataSourceMode)}
                variant="secondary"
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item key="mock">
                      {intl.formatMessage({ id: 'warehouseLayout.sourceMock', defaultMessage: 'Mock Data' })}
                    </ListBox.Item>
                    <ListBox.Item key="live">
                      {intl.formatMessage({ id: 'warehouseLayout.sourceLive', defaultMessage: 'Live Data' })}
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <TextField>
              <Label>{intl.formatMessage({ id: 'warehouseLayout.warehouseIdLabel', defaultMessage: 'Warehouse ID (Live)' })}</Label>
              <Input
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                placeholder="ex: WH-001"
                variant="secondary"
              />
            </TextField>

            <Button
              variant={isFullscreen ? 'secondary' : 'primary'}
              onPress={handleFullscreen}
              size="sm"
            >
              {isFullscreen
                ? intl.formatMessage({ id: 'warehouseLayout.exitFullscreen', defaultMessage: 'Exit Fullscreen' })
                : intl.formatMessage({ id: 'warehouseLayout.fullscreen', defaultMessage: 'Fullscreen' })}
            </Button>
          </div>

          <div className="grid gap-3 text-xs md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-linear-to-br from-white to-gray-50 p-3 dark:border-gray-700 dark:from-gray-900 dark:to-gray-800">
              <p className="font-semibold text-gray-700 dark:text-gray-200">
                {intl.formatMessage({ id: 'warehouseLayout.placeholderCoverageTitle', defaultMessage: 'Placeholder Coverage' })}
              </p>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                {intl.formatMessage(
                  {
                    id: 'warehouseLayout.placeholderCoverageDetail',
                    defaultMessage: 'Pallet: {totalPallet} • Floor: {totalFloor}',
                  },
                  {
                    totalPallet: diagnostics.totalPalletPlaceholders,
                    totalFloor: diagnostics.totalFloorPlaceholders,
                  },
                )}
              </p>
              <div className="mt-2">
                <Chip size="sm" variant="soft" color={diagnostics.totalPalletPlaceholders >= 216 ? 'success' : 'warning'}>
                  {intl.formatMessage({ id: 'warehouseLayout.targetSlots', defaultMessage: 'Target 216 Slots' })}
                </Chip>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-linear-to-br from-white to-gray-50 p-3 dark:border-gray-700 dark:from-gray-900 dark:to-gray-800">
              <p className="font-semibold text-gray-700 dark:text-gray-200">
                {intl.formatMessage({ id: 'warehouseLayout.dataCoverageTitle', defaultMessage: 'Data Coverage' })}
              </p>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                {intl.formatMessage(
                  {
                    id: 'warehouseLayout.dataCoverageDetail',
                    defaultMessage: 'Source pallets: {sourcePallets} • Rendered: {renderedPallets}',
                  },
                  {
                    sourcePallets: diagnostics.sourcePalletRows,
                    renderedPallets: diagnostics.renderedPallets,
                  },
                )}
              </p>
              <div className="mt-2">
                <Chip size="sm" variant="soft" color={coverageRate >= 95 ? 'success' : 'warning'}>
                  {coverageRate}% mapped
                </Chip>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-linear-to-br from-white to-gray-50 p-3 dark:border-gray-700 dark:from-gray-900 dark:to-gray-800">
              <p className="font-semibold text-gray-700 dark:text-gray-200">
                {intl.formatMessage({ id: 'warehouseLayout.issuesTitle', defaultMessage: 'Issues' })}
              </p>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                {intl.formatMessage(
                  {
                    id: 'warehouseLayout.issuesDetail',
                    defaultMessage: 'Missing placeholder: {missingPlaceholder} • Missing model: {missingModel}',
                  },
                  {
                    missingPlaceholder: diagnostics.missingPlaceholderRows,
                    missingModel: diagnostics.missingModelRows,
                  },
                )}
              </p>
              <div className="mt-2 flex gap-2">
                <Chip size="sm" variant="soft" color={diagnostics.missingPlaceholderRows > 0 ? 'warning' : 'success'}>
                  {intl.formatMessage({ id: 'warehouseLayout.placeholderLabel', defaultMessage: 'Placeholder' })}
                </Chip>
                <Chip size="sm" variant="soft" color={diagnostics.missingModelRows > 0 ? 'warning' : 'success'}>
                  {intl.formatMessage({ id: 'warehouseLayout.modelLabel', defaultMessage: 'Model' })}
                </Chip>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Warehouse 3D Viewer */}
      <Card
        id="warehouse-viewer"
        className="overflow-hidden border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <Card.Header className="px-6 py-4">
          <Card.Title>{intl.formatMessage({ id: 'warehouseLayout.viewerTitle', defaultMessage: '3D Warehouse Viewer' })}</Card.Title>
          <Card.Description>
            {intl.formatMessage({ id: 'warehouseLayout.viewerDescription', defaultMessage: 'Orbit, zoom, and inspect pallet placement mapped from location data.' })}
          </Card.Description>
        </Card.Header>
        <Card.Content className="p-0">
          <WarehouseScene
            height={700}
            showGrid={showGrid}
            dataSource={dataSource}
            warehouseId={dataSource === 'live' ? warehouseId.trim() : undefined}
            onDiagnosticsChange={setDiagnostics}
          />
        </Card.Content>
      </Card>

      {/* Layout Information */}
      <Card className="border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <Card.Header className="p-6 pb-3">
          <Card.Title>{intl.formatMessage({ id: 'warehouseLayout.layoutInfoTitle', defaultMessage: 'Layout Information' })}</Card.Title>
          <Card.Description>
            {intl.formatMessage({ id: 'warehouseLayout.layoutInfoDescription', defaultMessage: 'Core rules used by the scene mapper and model resolver.' })}
          </Card.Description>
        </Card.Header>
        <Card.Content className="px-6 pb-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {intl.formatMessage({ id: 'warehouseLayout.placementStrategyTitle', defaultMessage: 'Placement Strategy' })}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {intl.formatMessage({
                  id: 'warehouseLayout.placementStrategyDescription',
                  defaultMessage:
                    'Each pallet is mapped to a named placeholder from the GLB scene graph, using location ID normalization into three-digit slot keys.',
                })}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {intl.formatMessage({ id: 'warehouseLayout.modelResolutionTitle', defaultMessage: 'Model Resolution' })}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {intl.formatMessage({
                  id: 'warehouseLayout.modelResolutionDescription',
                  defaultMessage:
                    'Pallet type selects the matching *_on_pallet model variant with fallback to generic pallet when a specific asset is unavailable.',
                })}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {intl.formatMessage({ id: 'warehouseLayout.operatorControlsTitle', defaultMessage: 'Operator Controls' })}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {intl.formatMessage({
                  id: 'warehouseLayout.operatorControlsDescription',
                  defaultMessage:
                    'Orbit with mouse drag, zoom with wheel, and inspect diagnostics before switching from mock to live warehouse data.',
                })}
              </p>
            </div>
          </div>
        </Card.Content>
        <Card.Footer className="px-6 pb-6 pt-0">
          <Chip size="sm" variant="soft" color="accent">
            Simple modern layout
          </Chip>
        </Card.Footer>
      </Card>
    </div>
  );
}
