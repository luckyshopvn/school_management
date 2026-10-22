import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GRADE_LEVEL_TEMPLATES,
  PERMISSION_CODES,
  SCHOOL_LEVELS,
  type SchoolLevelCode,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { CatalogTable } from './CatalogTable.js';
import {
  createCurriculum,
  createGradeLevel,
  createRoom,
  listCurricula,
  listGradeLevels,
  listRooms,
  loadGradeLevelTemplate,
  updateCurriculum,
  updateGradeLevel,
  updateRoom,
  type Curriculum,
  type GradeLevel,
  type Room,
} from './catalogs-api.js';
import { UnitSelect, useUnitChoice } from './UnitSelect.js';
import { menuPageTitle } from '../pages/page-title.js';

// MH-34 Danh mục phòng học theo đơn vị (P01-11) và bậc học toàn trường (P01-12), độ tuổi theo tháng (YCTD-42). Khối thuộc cấp
// học, chương trình theo cấp (DT-19 phần 19b, YCTD-152)
type Tab = 'rooms' | 'grade-levels' | 'curricula';

const toNumber = (value: string | undefined) => (value === undefined || value === '' ? Number.NaN : Number(value));

function RoomsSection({ canManage, onChanged }: { canManage: boolean; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const rooms = useQuery({
    queryKey: ['rooms', orgUnitId],
    queryFn: () => listRooms(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rooms', orgUnitId] });

  return (
    <div className="flex flex-col gap-4">
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {!orgUnitId && !unitChoice.isPending ? (
        <Alert tone="warning">Chưa có đơn vị. Hãy mở năm học và tạo cây đơn vị trước.</Alert>
      ) : null}
      {orgUnitId ? (
        <CatalogTable<Room>
          key={orgUnitId}
          title="Phòng học"
          gridKey="rooms"
          rows={rooms.data}
          isPending={rooms.isPending}
          error={rooms.error}
          columns={[
            { label: 'Mã phòng', render: (row) => row.code },
            { label: 'Tên phòng', render: (row) => <span className="font-medium">{row.name}</span> },
            { label: 'Sức chứa', render: (row) => row.capacity },
          ]}
          fields={[
            { key: 'code', label: 'Mã phòng' },
            { key: 'name', label: 'Tên phòng' },
            { key: 'capacity', label: 'Sức chứa', kind: 'number' },
          ]}
          canManage={canManage}
          initialValues={{ code: '', name: '', capacity: '' }}
          valuesOf={(row) => ({ code: row.code, name: row.name, capacity: String(row.capacity) })}
          onCreate={async (values) => {
            await createRoom({
              org_unit_id: orgUnitId,
              code: values.code ?? '',
              name: values.name ?? '',
              capacity: toNumber(values.capacity),
            });
            await refresh();
          }}
          onUpdate={async (row, changes) => {
            await updateRoom(
              row.id,
              'name' in changes
                ? { code: changes.code, name: changes.name, capacity: toNumber(changes.capacity) }
                : { status: changes.status as Room['status'] },
            );
            await refresh();
          }}
          onChanged={onChanged}
        />
      ) : null}
    </div>
  );
}

const levelLabel = (level: SchoolLevelCode) => SCHOOL_LEVELS.find((item) => item.value === level)?.label ?? level;

// Tháng tuổi bỏ trống được ở khối của cấp ngoài Mầm non (YCTD-152): ô trống gửi null để máy chủ kiểm tra theo cấp
const toAge = (value: string | undefined) => (value === undefined || value.trim() === '' ? null : Number(value));

function ageText(row: GradeLevel): string {
  return row.age_from_months === null || row.age_to_months === null
    ? ''
    : `${row.age_from_months} đến ${row.age_to_months} tháng`;
}

// Nạp khối mẫu của cấp Tiểu học, THCS, THPT (DT-19 phần 19b, YCTD-152); khối đã có mã thì bỏ qua
function GradeTemplateLoader({
  templateLevels,
  onChanged,
}: {
  templateLevels: Array<{ value: SchoolLevelCode; label: string }>;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<SchoolLevelCode>(templateLevels[0]?.value ?? 'TH');
  const load = useMutation({
    mutationFn: () => loadGradeLevelTemplate(level),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      onChanged(
        `Đã nạp ${result.created.length} khối mẫu ${levelLabel(level)}` +
          (result.skipped.length > 0 ? `; bỏ qua mã đã có ${result.skipped.join(', ')}` : ''),
      );
    },
  });
  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Nạp khối mẫu theo cấp">
      <label className="text-label font-medium text-text">
        Cấp học của khối mẫu
        <select
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={level}
          onChange={(event) => setLevel(event.target.value as SchoolLevelCode)}
        >
          {templateLevels.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button disabled={load.isPending} onClick={() => load.mutate()}>
        Nạp khối mẫu
      </Button>
      {load.error ? (
        <Alert tone="danger">{load.error instanceof ApiError ? load.error.message : 'Không nạp được khối mẫu'}</Alert>
      ) : null}
    </div>
  );
}

function GradeLevelsSection({ canManage, onChanged }: { canManage: boolean; onChanged(message: string): void }) {
  // Cấp chọn được là cấp đang bật của trường (19a); khối mẫu chỉ có ở cấp đang bật ngoài Mầm non
  const { levels: LEVEL_OPTIONS } = useEnabledSchoolLevels();
  const templateLevels = LEVEL_OPTIONS.filter((option) => GRADE_LEVEL_TEMPLATES[option.value].length > 0);
  const queryClient = useQueryClient();
  const gradeLevels = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['grade-levels'] });

  return (
    <div className="flex flex-col gap-4">
      {canManage && templateLevels.length > 0 ? (
        <GradeTemplateLoader templateLevels={templateLevels} onChanged={onChanged} />
      ) : null}
      <CatalogTable<GradeLevel>
        title="Bậc học"
        gridKey="grade-levels"
        rows={gradeLevels.data}
        isPending={gradeLevels.isPending}
        error={gradeLevels.error}
        columns={[
          { label: 'Mã', render: (row) => row.code },
          { label: 'Tên bậc học', render: (row) => <span className="font-medium">{row.name}</span> },
          { id: 'school_level', label: 'Cấp học', render: (row) => levelLabel(row.school_level) },
          { label: 'Độ tuổi', render: ageText },
          { label: 'Thứ tự', render: (row) => row.order_no },
        ]}
        fields={[
          { key: 'code', label: 'Mã bậc học', fixedAfterCreate: true },
          { key: 'name', label: 'Tên bậc học' },
          { key: 'school_level', label: 'Cấp học', kind: 'select', options: LEVEL_OPTIONS, fixedAfterCreate: true },
          { key: 'age_from_months', label: 'Từ tháng tuổi', kind: 'number' },
          { key: 'age_to_months', label: 'Đến tháng tuổi', kind: 'number' },
          { key: 'order_no', label: 'Thứ tự', kind: 'number' },
        ]}
        canManage={canManage}
        initialValues={{ code: '', name: '', school_level: 'MN', age_from_months: '', age_to_months: '', order_no: '' }}
        valuesOf={(row) => ({
          code: row.code,
          name: row.name,
          school_level: row.school_level,
          age_from_months: row.age_from_months === null ? '' : String(row.age_from_months),
          age_to_months: row.age_to_months === null ? '' : String(row.age_to_months),
          order_no: String(row.order_no),
        })}
        onCreate={async (values) => {
          await createGradeLevel({
            code: values.code ?? '',
            name: values.name ?? '',
            school_level: (values.school_level || 'MN') as SchoolLevelCode,
            age_from_months: toAge(values.age_from_months),
            age_to_months: toAge(values.age_to_months),
            order_no: values.order_no ? Number(values.order_no) : 0,
          });
          await refresh();
        }}
        onUpdate={async (row, changes) => {
          await updateGradeLevel(
            row.id,
            'name' in changes
              ? {
                  name: changes.name,
                  age_from_months: toAge(changes.age_from_months),
                  age_to_months: toAge(changes.age_to_months),
                  order_no: changes.order_no ? Number(changes.order_no) : 0,
                }
              : { status: changes.status as GradeLevel['status'] },
          );
          await refresh();
        }}
        onChanged={onChanged}
      />
    </div>
  );
}

// Khung chương trình theo cấp (YCTD-152): khối áp dụng ghi mã khối cách nhau bởi dấu phẩy, trống là mọi khối của cấp
const toCodes = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code !== '');

function CurriculaSection({ canManage, onChanged }: { canManage: boolean; onChanged(message: string): void }) {
  const { levels: LEVEL_OPTIONS } = useEnabledSchoolLevels();
  const queryClient = useQueryClient();
  const curricula = useQuery({ queryKey: ['curricula'], queryFn: listCurricula });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['curricula'] });
  const DEFAULT_OPTIONS = [
    { value: 'false', label: 'Không' },
    { value: 'true', label: 'Có' },
  ];

  return (
    <CatalogTable<Curriculum>
      title="Chương trình"
      gridKey="curricula"
      rows={curricula.data}
      isPending={curricula.isPending}
      error={curricula.error}
      columns={[
        { label: 'Mã', render: (row) => row.code },
        { label: 'Tên chương trình', render: (row) => <span className="font-medium">{row.name}</span> },
        { id: 'school_level', label: 'Cấp học', render: (row) => levelLabel(row.school_level) },
        {
          id: 'grades',
          label: 'Khối áp dụng',
          render: (row) => (row.grade_level_codes.length > 0 ? row.grade_level_codes.join(', ') : 'Mọi khối của cấp'),
        },
        { id: 'is_default', label: 'Mặc định của cấp', render: (row) => (row.is_default ? 'Có' : '') },
      ]}
      fields={[
        { key: 'code', label: 'Mã chương trình', fixedAfterCreate: true },
        { key: 'name', label: 'Tên chương trình' },
        { key: 'school_level', label: 'Cấp học', kind: 'select', options: LEVEL_OPTIONS, fixedAfterCreate: true },
        { key: 'grade_level_codes', label: 'Khối áp dụng (mã, cách nhau bởi dấu phẩy)' },
        { key: 'is_default', label: 'Mặc định của cấp', kind: 'select', options: DEFAULT_OPTIONS },
      ]}
      canManage={canManage}
      initialValues={{ code: '', name: '', school_level: 'MN', grade_level_codes: '', is_default: 'false' }}
      valuesOf={(row) => ({
        code: row.code,
        name: row.name,
        school_level: row.school_level,
        grade_level_codes: row.grade_level_codes.join(', '),
        is_default: String(row.is_default),
      })}
      onCreate={async (values) => {
        await createCurriculum({
          code: values.code ?? '',
          name: values.name ?? '',
          school_level: (values.school_level || 'MN') as SchoolLevelCode,
          grade_level_codes: toCodes(values.grade_level_codes),
          is_default: values.is_default === 'true',
          note: null,
        });
        await refresh();
      }}
      onUpdate={async (row, changes) => {
        await updateCurriculum(
          row.id,
          'name' in changes
            ? {
                name: changes.name,
                grade_level_codes: toCodes(changes.grade_level_codes),
                is_default:
                  (changes.is_default === 'true') === row.is_default ? undefined : changes.is_default === 'true',
              }
            : { status: changes.status as Curriculum['status'] },
        );
        await refresh();
      }}
      onChanged={onChanged}
    />
  );
}

export function RoomsAndGradeLevelsPage() {
  const canManageRooms = useHasPermission(PERMISSION_CODES.roomManage);
  const canManageGradeLevels = useHasPermission(PERMISSION_CODES.catalogManage);
  const [tab, setTab] = useState<Tab>('rooms');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/rooms')}</h1>
        <div className="flex gap-2" role="tablist" aria-label="Danh mục">
          <Button
            role="tab"
            aria-selected={tab === 'rooms'}
            variant={tab === 'rooms' ? 'secondary' : 'text'}
            onClick={() => setTab('rooms')}
          >
            Phòng học
          </Button>
          <Button
            role="tab"
            aria-selected={tab === 'grade-levels'}
            variant={tab === 'grade-levels' ? 'secondary' : 'text'}
            onClick={() => setTab('grade-levels')}
          >
            Bậc học
          </Button>
          <Button
            role="tab"
            aria-selected={tab === 'curricula'}
            variant={tab === 'curricula' ? 'secondary' : 'text'}
            onClick={() => setTab('curricula')}
          >
            Chương trình
          </Button>
        </div>
        {tab === 'rooms' ? (
          <RoomsSection canManage={canManageRooms} onChanged={setToastMessage} />
        ) : tab === 'grade-levels' ? (
          <GradeLevelsSection canManage={canManageGradeLevels} onChanged={setToastMessage} />
        ) : (
          <CurriculaSection canManage={canManageGradeLevels} onChanged={setToastMessage} />
        )}
      </div>
    </AppShell>
  );
}
