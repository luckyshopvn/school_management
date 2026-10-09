import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { CatalogTable, type CatalogColumn } from './CatalogTable.js';
import {
  createDepartment,
  createJobTitle,
  listDepartments,
  listJobTitles,
  updateDepartment,
  updateJobTitle,
  type Department,
  type JobTitle,
} from './catalogs-api.js';
import { UnitSelect, useUnitChoice } from './UnitSelect.js';

// MH-49 Phòng ban và chức danh theo đơn vị (P01-03, P01-04); phòng ban hiện dạng cây theo phòng ban cha
type Tab = 'departments' | 'job-titles';

// Sắp phòng ban theo cây: phòng ban gốc trước, phòng ban con ngay sau phòng ban cha
function orderAsTree(departments: Department[]): Array<Department & { depth: number }> {
  const result: Array<Department & { depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const department of departments.filter((row) => row.parent_id === parentId)) {
      result.push({ ...department, depth });
      visit(department.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

function DepartmentsSection({
  orgUnitId,
  canManage,
  onChanged,
}: {
  orgUnitId: string;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: ['departments', orgUnitId], queryFn: () => listDepartments(orgUnitId) });
  const rows = departments.data ? orderAsTree(departments.data) : undefined;
  const nameOf = (id: string | null) => departments.data?.find((row) => row.id === id)?.name ?? '';
  const parentOptions = [
    { value: '', label: 'Không có' },
    ...(departments.data ?? [])
      .filter((row) => row.status === 'active')
      .map((row) => ({ value: row.id, label: row.name })),
  ];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['departments', orgUnitId] });
  const columns: CatalogColumn<Department & { depth: number }>[] = [
    {
      label: 'Phòng ban',
      render: (row) => (
        <span style={{ paddingLeft: `${row.depth * 24}px` }} className="font-medium">
          {row.name}
        </span>
      ),
    },
    { label: 'Phòng ban cha', render: (row) => nameOf(row.parent_id) },
  ];

  return (
    <CatalogTable
      title="Phòng ban"
      rows={rows}
      isPending={departments.isPending}
      error={departments.error}
      columns={columns}
      fields={[
        { key: 'name', label: 'Tên phòng ban' },
        { key: 'parent_id', label: 'Phòng ban cha', kind: 'select', options: parentOptions },
      ]}
      canManage={canManage}
      initialValues={{ name: '', parent_id: '' }}
      valuesOf={(row) => ({ name: row.name, parent_id: row.parent_id ?? '' })}
      onCreate={async (values) => {
        await createDepartment({
          org_unit_id: orgUnitId,
          name: values.name ?? '',
          parent_id: values.parent_id || null,
        });
        await refresh();
      }}
      onUpdate={async (row, changes) => {
        await updateDepartment(
          row.id,
          'name' in changes
            ? { name: changes.name, parent_id: changes.parent_id || null }
            : { status: changes.status as Department['status'] },
        );
        await refresh();
      }}
      onChanged={onChanged}
    />
  );
}

function JobTitlesSection({
  orgUnitId,
  canManage,
  onChanged,
}: {
  orgUnitId: string;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const jobTitles = useQuery({ queryKey: ['job-titles', orgUnitId], queryFn: () => listJobTitles(orgUnitId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['job-titles', orgUnitId] });
  const columns: CatalogColumn<JobTitle>[] = [
    { label: 'Chức danh', render: (row) => <span className="font-medium">{row.name}</span> },
    { label: 'Cấp bậc', render: (row) => row.level ?? '' },
  ];

  return (
    <CatalogTable
      title="Chức danh"
      rows={jobTitles.data}
      isPending={jobTitles.isPending}
      error={jobTitles.error}
      columns={columns}
      fields={[
        { key: 'name', label: 'Tên chức danh' },
        { key: 'level', label: 'Cấp bậc' },
      ]}
      canManage={canManage}
      initialValues={{ name: '', level: '' }}
      valuesOf={(row) => ({ name: row.name, level: row.level ?? '' })}
      onCreate={async (values) => {
        await createJobTitle({ org_unit_id: orgUnitId, name: values.name ?? '', level: values.level || null });
        await refresh();
      }}
      onUpdate={async (row, changes) => {
        await updateJobTitle(
          row.id,
          'name' in changes
            ? { name: changes.name, level: changes.level || null }
            : { status: changes.status as JobTitle['status'] },
        );
        await refresh();
      }}
      onChanged={onChanged}
    />
  );
}

export function DepartmentsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.departmentManage);
  const unitChoice = useUnitChoice();
  const [tab, setTab] = useState<Tab>('departments');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Phòng ban và chức danh</h1>
        <div className="flex flex-wrap items-end gap-6">
          <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
          <div className="flex gap-2" role="tablist" aria-label="Danh mục">
            <Button
              role="tab"
              aria-selected={tab === 'departments'}
              variant={tab === 'departments' ? 'secondary' : 'text'}
              onClick={() => setTab('departments')}
            >
              Phòng ban
            </Button>
            <Button
              role="tab"
              aria-selected={tab === 'job-titles'}
              variant={tab === 'job-titles' ? 'secondary' : 'text'}
              onClick={() => setTab('job-titles')}
            >
              Chức danh
            </Button>
          </div>
        </div>
        {!unitChoice.selectedId && !unitChoice.isPending ? (
          <Alert tone="warning">Chưa có đơn vị. Hãy mở năm học và tạo cây đơn vị trước.</Alert>
        ) : null}
        {unitChoice.selectedId && tab === 'departments' ? (
          <DepartmentsSection
            key={unitChoice.selectedId}
            orgUnitId={unitChoice.selectedId}
            canManage={canManage}
            onChanged={setToastMessage}
          />
        ) : null}
        {unitChoice.selectedId && tab === 'job-titles' ? (
          <JobTitlesSection
            key={unitChoice.selectedId}
            orgUnitId={unitChoice.selectedId}
            canManage={canManage}
            onChanged={setToastMessage}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
