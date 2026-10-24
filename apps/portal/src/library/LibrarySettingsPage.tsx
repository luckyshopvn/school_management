import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, SCHOOL_LEVEL_CODES, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { useHasPermission } from '../session/permissions.js';
import {
  createLibraryCategory,
  LEVEL_LABELS,
  READER_KIND_LABELS,
  readLibrarySettings,
  saveLibrarySettings,
  updateLibraryCategory,
  type LibraryCategory,
  type LibrarySettings,
  type ReaderKind,
} from './library-api.js';
import { EmptyRow, ErrorAlert, HEAD_CLASS, LibraryFrame, Panel, TH_CLASS, useToast } from './library-common.js';

// Quy định mượn và phân loại ấn phẩm (DT-22 phần 22a, tài liệu 32 mục 13.4, YCTD-181): cấp có học sinh mượn sách, số ngày giữ
// chỗ đặt trước, quy định mượn của cán bộ và học sinh (số bản, số ngày, số lần gia hạn, phạt mỗi ngày trễ), ngưỡng và bật,
// tắt từng chỉ tiêu theo chuẩn thư viện, phân loại ấn phẩm (cho mượn về hay chỉ đọc tại chỗ)

const RULE_FIELD_LABELS = {
  max_items: 'số bản tối đa',
  loan_days: 'số ngày mượn',
  max_renewals: 'số lần gia hạn',
  fine_per_day: 'phạt mỗi ngày trễ',
};

function SettingsForm({
  settings,
  canManage,
  onSaved,
}: {
  settings: LibrarySettings;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [levels, setLevels] = useState<SchoolLevelCode[]>(settings.student_levels);
  const [holdDays, setHoldDays] = useState(String(settings.hold_days));
  const [rules, setRules] = useState(
    settings.rules.map((rule) => ({
      reader_kind: rule.reader_kind,
      max_items: String(rule.max_items),
      loan_days: String(rule.loan_days),
      max_renewals: String(rule.max_renewals),
      fine_per_day: String(rule.fine_per_day),
    })),
  );
  const [indicators, setIndicators] = useState(
    settings.indicators.map((item) => ({
      code: item.code,
      name: item.name,
      threshold: item.threshold === null ? '' : String(item.threshold),
      enabled: item.enabled,
    })),
  );
  const save = useMutation({
    mutationFn: () =>
      saveLibrarySettings({
        student_levels: levels,
        hold_days: Number(holdDays),
        rules: rules.map((rule) => ({
          reader_kind: rule.reader_kind,
          max_items: Number(rule.max_items),
          loan_days: Number(rule.loan_days),
          max_renewals: Number(rule.max_renewals),
          fine_per_day: Number(rule.fine_per_day),
        })),
        indicators: indicators.map((item) => ({
          code: item.code,
          threshold: item.threshold.trim() === '' ? null : Number(item.threshold),
          enabled: item.enabled,
        })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['library-settings'] });
      onSaved('Đã lưu quy định mượn');
    },
  });
  const setRule = (
    kind: ReaderKind,
    field: 'max_items' | 'loan_days' | 'max_renewals' | 'fine_per_day',
    value: string,
  ) => setRules(rules.map((rule) => (rule.reader_kind === kind ? { ...rule, [field]: value } : rule)));
  return (
    <Panel>
      <h2 className="text-section-title font-semibold text-text">Quy định mượn</h2>
      <fieldset className="flex flex-col gap-2" disabled={!canManage}>
        <legend className="text-label font-medium text-text">Cấp có học sinh được mượn sách</legend>
        <div className="flex flex-wrap gap-4 text-content">
          {SCHOOL_LEVEL_CODES.map((code) => (
            <label key={code} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={levels.includes(code)}
                onChange={(event) =>
                  setLevels(event.target.checked ? [...levels, code] : levels.filter((item) => item !== code))
                }
              />
              {code} ({LEVEL_LABELS[code]})
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Số ngày giữ chỗ khi sách đặt trước có bản (1 đến 30)"
          inputMode="numeric"
          value={holdDays}
          disabled={!canManage}
          onChange={(event) => setHoldDays(event.target.value)}
        />
      </div>
      <table className="w-full text-content" aria-label="Quy định mượn theo loại bạn đọc">
        <thead className={HEAD_CLASS}>
          <tr>
            <th className={TH_CLASS}>Loại bạn đọc</th>
            <th className={TH_CLASS}>Số bản tối đa</th>
            <th className={TH_CLASS}>Số ngày mượn</th>
            <th className={TH_CLASS}>Số lần gia hạn</th>
            <th className={TH_CLASS}>Phạt mỗi ngày trễ (đồng)</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.reader_kind} className="border-t border-border">
              <td className={`${TH_CLASS} font-semibold`}>{READER_KIND_LABELS[rule.reader_kind]}</td>
              {(['max_items', 'loan_days', 'max_renewals', 'fine_per_day'] as const).map((field) => (
                <td key={field} className={TH_CLASS}>
                  <input
                    aria-label={`${READER_KIND_LABELS[rule.reader_kind]}: ${RULE_FIELD_LABELS[field]}`}
                    inputMode="numeric"
                    value={rule[field]}
                    disabled={!canManage}
                    onChange={(event) => setRule(rule.reader_kind, field, event.target.value)}
                    className="w-28 rounded-lg border border-border bg-card px-3 py-2 text-content"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="text-section-title font-semibold text-text">Chỉ tiêu theo chuẩn thư viện</h2>
      <Alert tone="info">
        Ngưỡng để trống đến khi nhà trường áp dụng văn bản chuẩn thư viện; chưa có ngưỡng thì báo cáo ghi "Chưa kết
        luận".
      </Alert>
      <table className="w-full text-content" aria-label="Chỉ tiêu theo chuẩn thư viện">
        <thead className={HEAD_CLASS}>
          <tr>
            <th className={TH_CLASS}>Dùng</th>
            <th className={TH_CLASS}>Chỉ tiêu</th>
            <th className={TH_CLASS}>Ngưỡng tối thiểu</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((item) => (
            <tr key={item.code} className="border-t border-border">
              <td className={TH_CLASS}>
                <input
                  type="checkbox"
                  aria-label={`Dùng chỉ tiêu ${item.name}`}
                  checked={item.enabled}
                  disabled={!canManage}
                  onChange={(event) =>
                    setIndicators(
                      indicators.map((row) =>
                        row.code === item.code ? { ...row, enabled: event.target.checked } : row,
                      ),
                    )
                  }
                />
              </td>
              <td className={TH_CLASS}>{item.name}</td>
              <td className={TH_CLASS}>
                <input
                  aria-label={`Ngưỡng ${item.name}`}
                  inputMode="decimal"
                  value={item.threshold}
                  disabled={!canManage}
                  onChange={(event) =>
                    setIndicators(
                      indicators.map((row) =>
                        row.code === item.code ? { ...row, threshold: event.target.value } : row,
                      ),
                    )
                  }
                  className="w-28 rounded-lg border border-border bg-card px-3 py-2 text-content"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorAlert error={save.error} />
      {canManage ? (
        <div>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Lưu quy định
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

function CategoryRow({
  category,
  canManage,
  onSaved,
}: {
  category: LibraryCategory;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState<string>();
  const update = useMutation({
    mutationFn: (changes: Partial<Pick<LibraryCategory, 'name' | 'lendable' | 'status'>>) =>
      updateLibraryCategory(category.id, changes),
    onSuccess: async () => {
      setName(undefined);
      await queryClient.invalidateQueries({ queryKey: ['library-settings'] });
      onSaved('Đã cập nhật phân loại');
    },
  });
  return (
    <tr className="border-t border-border">
      <td className={TH_CLASS}>{category.code}</td>
      <td className={TH_CLASS}>
        {name === undefined ? (
          category.name
        ) : (
          <div className="flex items-center gap-2">
            <input
              aria-label={`Tên phân loại ${category.code}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content"
            />
            <Button
              variant="primary"
              disabled={update.isPending || name.trim() === ''}
              onClick={() => update.mutate({ name: name.trim() })}
            >
              Lưu
            </Button>
            <Button onClick={() => setName(undefined)}>Hủy</Button>
          </div>
        )}
        <ErrorAlert error={update.error} />
      </td>
      <td className={TH_CLASS}>{category.lendable ? 'Cho mượn về' : 'Đọc tại chỗ'}</td>
      <td className={TH_CLASS}>
        <StatusBadge
          tone={category.status === 'active' ? 'success' : 'neutral'}
          label={category.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
        />
      </td>
      <td className={TH_CLASS}>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button aria-label={`Sửa tên ${category.name}`} onClick={() => setName(category.name)}>
              Sửa tên
            </Button>
            <Button disabled={update.isPending} onClick={() => update.mutate({ lendable: !category.lendable })}>
              {category.lendable ? 'Chuyển đọc tại chỗ' : 'Cho mượn về'}
            </Button>
            <Button
              disabled={update.isPending}
              onClick={() => update.mutate({ status: category.status === 'active' ? 'inactive' : 'active' })}
            >
              {category.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
            </Button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function CategoriesBlock({
  categories,
  canManage,
  onSaved,
}: {
  categories: LibraryCategory[];
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ code: '', name: '', lendable: true });
  const create = useMutation({
    mutationFn: () =>
      createLibraryCategory({
        code: draft.code.trim(),
        name: draft.name.trim(),
        lendable: draft.lendable,
        order_no: (categories[categories.length - 1]?.order_no ?? 0) + 10,
      }),
    onSuccess: async () => {
      setDraft({ code: '', name: '', lendable: true });
      await queryClient.invalidateQueries({ queryKey: ['library-settings'] });
      onSaved('Đã thêm phân loại');
    },
  });
  return (
    <Panel>
      <h2 className="text-section-title font-semibold text-text">Phân loại ấn phẩm</h2>
      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Mã phân loại"
            value={draft.code}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
          <TextField
            label="Tên phân loại"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <label className="flex items-center gap-2 pb-2 text-content">
            <input
              type="checkbox"
              checked={draft.lendable}
              onChange={(event) => setDraft({ ...draft, lendable: event.target.checked })}
            />
            Cho mượn về
          </label>
          <Button
            variant="primary"
            disabled={create.isPending || draft.code.trim() === '' || draft.name.trim() === ''}
            onClick={() => create.mutate()}
          >
            Thêm phân loại
          </Button>
        </div>
      ) : null}
      <ErrorAlert error={create.error} />
      <table className="w-full text-content" aria-label="Phân loại ấn phẩm">
        <thead className={HEAD_CLASS}>
          <tr>
            <th className={TH_CLASS}>Mã</th>
            <th className={TH_CLASS}>Tên</th>
            <th className={TH_CLASS}>Hình thức</th>
            <th className={TH_CLASS}>Trạng thái</th>
            <th className={TH_CLASS} />
          </tr>
        </thead>
        <tbody>
          {categories.length === 0 ? <EmptyRow columns={5} message="Chưa có phân loại" /> : null}
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} canManage={canManage} onSaved={onSaved} />
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function LibrarySettingsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.schoolLibraryManage);
  const toast = useToast();
  const settings = useQuery({ queryKey: ['library-settings'], queryFn: readLibrarySettings });
  const data = settings.data;
  return (
    <LibraryFrame path="/library/settings" toast={toast}>
      <ErrorAlert error={settings.error} />
      {data ? (
        <>
          <SettingsForm
            key={JSON.stringify([data.student_levels, data.hold_days, data.rules, data.indicators])}
            settings={data}
            canManage={canManage}
            onSaved={toast.show}
          />
          <CategoriesBlock categories={data.categories} canManage={canManage} onSaved={toast.show} />
        </>
      ) : null}
    </LibraryFrame>
  );
}
