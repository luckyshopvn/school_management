import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SCHOOL_LEVELS, TEACHING_TOOL_SECTIONS, TEACHING_TOOLS } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { readSettings, saveSettings, type EffectiveSetting } from './settings-api.js';

// Hộp công cụ giảng dạy (DT-29, YCTD-325): quản trị trường bật, tắt từng công cụ của ứng dụng giáo viên; giá trị là danh sách công
// cụ tắt (`teaching_tools_disabled`) đặt ở Trường chính. Công cụ thuộc tính năng gói chưa bật vẫn ẩn dù ở đây đang bật
const KEY = 'teaching_tools_disabled';

function levelNames(levels: readonly string[]): string {
  return levels.map((code) => SCHOOL_LEVELS.find((level) => level.value === code)?.label ?? code).join(', ');
}

export function TeachingToolsSettingsBlock({
  rootId,
  editable,
  onSaved,
}: {
  rootId: string;
  editable: boolean;
  onSaved(message: string): void;
}) {
  const settings = useQuery({ queryKey: ['settings', rootId], queryFn: () => readSettings(rootId) });
  if (settings.isPending) {
    return <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />;
  }
  const setting = settings.data?.find((item) => item.key === KEY);
  if (settings.isError || !setting) {
    return null;
  }
  return <TeachingToolsForm rootId={rootId} setting={setting} editable={editable} onSaved={onSaved} />;
}

function TeachingToolsForm({
  rootId,
  setting,
  editable,
  onSaved,
}: {
  rootId: string;
  setting: EffectiveSetting;
  editable: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [disabled, setDisabled] = useState<string[]>(() =>
    Array.isArray(setting.value) ? setting.value.filter((code): code is string => typeof code === 'string') : [],
  );
  const save = useMutation({
    mutationFn: () => saveSettings(rootId, { [KEY]: disabled }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', rootId] });
      onSaved('Đã ghi công cụ của Hộp công cụ giảng dạy');
    },
  });
  const toggle = (code: string, enabled: boolean) =>
    setDisabled((current) => (enabled ? current.filter((item) => item !== code) : [...current, code]));

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label="Hộp công cụ giảng dạy"
    >
      <h2 className="text-section-title font-semibold text-text">Hộp công cụ giảng dạy</h2>
      <p className="text-label text-text-secondary">
        Công cụ đánh dấu thì giáo viên thấy ở ứng dụng giáo viên, theo cấp học của lớp đang dạy. Bỏ đánh dấu để tắt công
        cụ cho cả trường.
      </p>
      {save.error ? (
        <Alert tone="danger">
          {save.error instanceof ApiError
            ? [save.error.message, ...save.error.details.map((detail) => detail.message)].join(': ')
            : 'Không kết nối được tới máy chủ, vui lòng thử lại'}
        </Alert>
      ) : null}
      {TEACHING_TOOL_SECTIONS.map((section) => {
        const tools = TEACHING_TOOLS.filter((tool) => tool.section === section.key);
        return tools.length > 0 ? (
          <fieldset key={section.key} className="flex flex-col gap-2">
            <legend className="text-content font-semibold text-text">{section.label}</legend>
            {tools.map((tool) => (
              <label key={tool.key} className="flex items-start gap-2 text-content text-text">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!disabled.includes(tool.key)}
                  disabled={!editable}
                  onChange={(event) => toggle(tool.key, event.target.checked)}
                />
                <span>
                  {tool.label}
                  <span className="ml-2 text-label text-text-secondary">{levelNames(tool.levels)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null;
      })}
      {editable ? (
        <div>
          <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
            Ghi
          </Button>
        </div>
      ) : null}
    </section>
  );
}
