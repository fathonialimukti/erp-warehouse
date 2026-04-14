import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Card,
  Chip,
} from '@heroui/react';
import {
  WarehouseScene,
  type WarehouseDataSourceMode,
  type WarehouseSceneDiagnostics,
  type WarehousePerformanceStats,
} from '../components/WarehouseScene';

export default function WarehouseLayoutPage() {
  const intl = useIntl();
  const showGrid = false;
  const dataSource: WarehouseDataSourceMode = 'mock';
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
  const [perf, setPerf] = useState<WarehousePerformanceStats>({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    memoryMb: null,
  });

  return (
    <div className="space-y-4">
      {/* Page header */}
      <Card>
        <Card.Header>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Card.Title>
                {intl.formatMessage({ id: 'warehouseLayout.pageTitle', defaultMessage: 'Warehouse Layout 3D' })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({
                  id: 'warehouseLayout.pageDescription',
                  defaultMessage:
                    'Data-driven visualization with runtime mapping from pallet placeholders into active pallet records.',
                })}
              </Card.Description>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Chip size="sm" variant="soft" color="success">
                {intl.formatMessage({ id: 'warehouseLayout.mockValidation', defaultMessage: 'Mock' })}
              </Chip>
              <Chip size="sm" variant="soft" color="accent">
                {intl.formatMessage({ id: 'warehouseLayout.renderedCount', defaultMessage: '{count} rendered' }, { count: diagnostics.renderedPallets })}
              </Chip>
              <Chip size="sm" variant="soft" color={coverageRate >= 95 ? 'success' : 'warning'}>
                {coverageRate}%
              </Chip>
            </div>
          </div>
        </Card.Header>
      </Card>

      {/* Diagnostics */}
      <Card>
        <Card.Header>
          <Card.Title>{intl.formatMessage({ id: 'warehouseLayout.diagnosticsTitle', defaultMessage: 'Diagnostics' })}</Card.Title>
          <Card.Description>
            {intl.formatMessage({ id: 'warehouseLayout.diagnosticsDescription', defaultMessage: 'Current mapping status for the 3D warehouse scene.' })}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <Card.Header>
                <Card.Title className="text-sm">
                  {intl.formatMessage({ id: 'warehouseLayout.placeholderCoverageTitle', defaultMessage: 'Placeholder Coverage' })}
                </Card.Title>
                <Card.Description className="text-xs">
                  {intl.formatMessage(
                    { id: 'warehouseLayout.placeholderCoverageDetail', defaultMessage: 'Pallet: {totalPallet} · Floor: {totalFloor}' },
                    { totalPallet: diagnostics.totalPalletPlaceholders, totalFloor: diagnostics.totalFloorPlaceholders },
                  )}
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <Chip size="sm" variant="soft" color={diagnostics.totalPalletPlaceholders >= 216 ? 'success' : 'warning'}>
                  {intl.formatMessage({ id: 'warehouseLayout.targetSlots', defaultMessage: 'Target 216 Slots' })}
                </Chip>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title className="text-sm">
                  {intl.formatMessage({ id: 'warehouseLayout.dataCoverageTitle', defaultMessage: 'Data Coverage' })}
                </Card.Title>
                <Card.Description className="text-xs">
                  {intl.formatMessage(
                    { id: 'warehouseLayout.dataCoverageDetail', defaultMessage: 'Source: {sourcePallets} · Rendered: {renderedPallets}' },
                    { sourcePallets: diagnostics.sourcePalletRows, renderedPallets: diagnostics.renderedPallets },
                  )}
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <Chip size="sm" variant="soft" color={coverageRate >= 95 ? 'success' : 'warning'}>
                  {coverageRate}% mapped
                </Chip>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title className="text-sm">
                  {intl.formatMessage({ id: 'warehouseLayout.issuesTitle', defaultMessage: 'Issues' })}
                </Card.Title>
                <Card.Description className="text-xs">
                  {intl.formatMessage(
                    { id: 'warehouseLayout.issuesDetail', defaultMessage: 'Placeholder: {missingPlaceholder} · Model: {missingModel}' },
                    { missingPlaceholder: diagnostics.missingPlaceholderRows, missingModel: diagnostics.missingModelRows },
                  )}
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex gap-2">
                <Chip size="sm" variant="soft" color={diagnostics.missingPlaceholderRows > 0 ? 'warning' : 'success'}>
                  {intl.formatMessage({ id: 'warehouseLayout.placeholderLabel', defaultMessage: 'Placeholder' })}
                </Chip>
                <Chip size="sm" variant="soft" color={diagnostics.missingModelRows > 0 ? 'warning' : 'success'}>
                  {intl.formatMessage({ id: 'warehouseLayout.modelLabel', defaultMessage: 'Model' })}
                </Chip>
              </Card.Content>
            </Card>
          </div>
        </Card.Content>
      </Card>

      {/* Warehouse 3D Viewer */}
      <Card id="warehouse-viewer">
        <Card.Header>
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
            warehouseId={undefined}
            onDiagnosticsChange={setDiagnostics}
          onPerformanceUpdate={setPerf}
          />
        </Card.Content>
      </Card>

      {/* Layout Information */}
      {/* Performance Metrics */}
      <Card>
        <Card.Header>
          <Card.Title>{intl.formatMessage({ id: 'warehouseLayout.perfTitle', defaultMessage: 'Performance' })}</Card.Title>
          <Card.Description>
            {intl.formatMessage({ id: 'warehouseLayout.perfDescription', defaultMessage: 'Live render metrics from the 3D scene.' })}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card>
              <Card.Header>
                <Card.Title className="text-sm">FPS</Card.Title>
                <Card.Description className="text-xs">Frames per second</Card.Description>
              </Card.Header>
              <Card.Content>
                <Chip size="sm" variant="soft" color={perf.fps >= 55 ? 'success' : perf.fps >= 30 ? 'warning' : 'danger'}>
                  {perf.fps}
                </Chip>
              </Card.Content>
            </Card>
            <Card>
              <Card.Header>
                <Card.Title className="text-sm">Draw Calls</Card.Title>
                <Card.Description className="text-xs">Per frame</Card.Description>
              </Card.Header>
              <Card.Content>
                <Chip size="sm" variant="soft" color={perf.drawCalls <= 200 ? 'success' : 'warning'}>
                  {perf.drawCalls}
                </Chip>
              </Card.Content>
            </Card>
            <Card>
              <Card.Header>
                <Card.Title className="text-sm">Triangles</Card.Title>
                <Card.Description className="text-xs">Total in scene</Card.Description>
              </Card.Header>
              <Card.Content>
                <Chip size="sm" variant="soft" color="accent">
                  {perf.triangles.toLocaleString()}
                </Chip>
              </Card.Content>
            </Card>
            <Card>
              <Card.Header>
                <Card.Title className="text-sm">Geometries</Card.Title>
                <Card.Description className="text-xs">GPU buffers</Card.Description>
              </Card.Header>
              <Card.Content>
                <Chip size="sm" variant="soft" color="accent">
                  {perf.geometries}
                </Chip>
              </Card.Content>
            </Card>
            <Card>
              <Card.Header>
                <Card.Title className="text-sm">Textures</Card.Title>
                <Card.Description className="text-xs">GPU uploads</Card.Description>
              </Card.Header>
              <Card.Content>
                <Chip size="sm" variant="soft" color="accent">
                  {perf.textures}
                </Chip>
              </Card.Content>
            </Card>
            <Card>
              <Card.Header>
                <Card.Title className="text-sm">JS Heap</Card.Title>
                <Card.Description className="text-xs">RAM usage</Card.Description>
              </Card.Header>
              <Card.Content>
                <Chip size="sm" variant="soft" color={perf.memoryMb !== null && perf.memoryMb > 512 ? 'warning' : 'success'}>
                  {perf.memoryMb !== null ? `${perf.memoryMb} MB` : 'N/A'}
                </Chip>
              </Card.Content>
            </Card>
          </div>
        </Card.Content>
      </Card>

      {/* Layout Information */}
      <Card>
        <Card.Header>
          <Card.Title>{intl.formatMessage({ id: 'warehouseLayout.layoutInfoTitle', defaultMessage: 'Layout Information' })}</Card.Title>
          <Card.Description>
            {intl.formatMessage({ id: 'warehouseLayout.layoutInfoDescription', defaultMessage: 'Core rules used by the scene mapper and model resolver.' })}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <Card.Header>
                <Card.Title className="text-sm">
                  {intl.formatMessage({ id: 'warehouseLayout.placementStrategyTitle', defaultMessage: 'Placement Strategy' })}
                </Card.Title>
                <Card.Description className="text-xs">
                  {intl.formatMessage({
                    id: 'warehouseLayout.placementStrategyDescription',
                    defaultMessage:
                      'Each pallet is mapped to a named placeholder from the GLB scene graph, using location ID normalization into three-digit slot keys.',
                  })}
                </Card.Description>
              </Card.Header>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title className="text-sm">
                  {intl.formatMessage({ id: 'warehouseLayout.modelResolutionTitle', defaultMessage: 'Model Resolution' })}
                </Card.Title>
                <Card.Description className="text-xs">
                  {intl.formatMessage({
                    id: 'warehouseLayout.modelResolutionDescription',
                    defaultMessage:
                      'Pallet type selects the matching *_on_pallet model variant with fallback to generic pallet when a specific asset is unavailable.',
                  })}
                </Card.Description>
              </Card.Header>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title className="text-sm">
                  {intl.formatMessage({ id: 'warehouseLayout.operatorControlsTitle', defaultMessage: 'Operator Controls' })}
                </Card.Title>
                <Card.Description className="text-xs">
                  {intl.formatMessage({
                    id: 'warehouseLayout.operatorControlsDescription',
                    defaultMessage:
                      'Orbit with mouse drag, zoom with wheel, and inspect diagnostics before switching from mock to live warehouse data.',
                  })}
                </Card.Description>
              </Card.Header>
            </Card>
          </div>
        </Card.Content>
        <Card.Footer>
          <Chip size="sm" variant="soft" color="accent">
            {intl.formatMessage({ id: 'warehouseLayout.layoutInfoFooter', defaultMessage: 'Scene mapper v1' })}
          </Chip>
        </Card.Footer>
      </Card>
    </div>
  );
}
