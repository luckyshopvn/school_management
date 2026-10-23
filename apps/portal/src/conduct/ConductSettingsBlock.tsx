import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { messageOf, readConductSettings, saveConductSettings } from './conduct-api.js';

// Thẻ "Nề nếp, thi đua lớp" ở 1.4 Cấu hình trường (DT-20 phần 20b, YCTD-159): trường tự bật hoặc tắt, đặt điểm nền mỗi
// tuần của lớp. Tắt thì không ghi điểm mới, dữ liệu đã ghi giữ nguyên
export function ConductSettingsBlock({ editable, onSaved }: { editable: boolean; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['conduct-settings'], queryFn: readConductSettings });
  const [enabled, setEnabled] = useState(false);
  const [basePoints, setBasePoints] = useState('100');
  useEffect(() => {
    if (settings.data) {
      setEnabled(settings.data.enabled);
      setBasePoints(String(settings.data.base_points));
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () => saveConductSettings({ enabled, base_points: Number(basePoints) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conduct-settings'] });
      onSaved('Đã lưu cấu hình nề nếp, thi đua lớp');
    },
  });
  if (settings.isError) {
    return null;
  }
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label="Nề nếp, thi đua lớp"
    >
      <h2 className="text-section-title font-semibold text-text">Nề nếp, thi đua lớp</h2>
      <p className="text-label text-text-secondary">
        Tuỳ trường. Bật thì giáo viên trực ghi điểm cộng, trừ theo tiêu chí cho lớp Tiểu học; điểm tuần của lớp là điểm
        nền cộng tổng điểm đã ghi.
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 pb-2 text-label text-text">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!editable}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Bật nề nếp, thi đua lớp
        </label>
        <TextField
          label="Điểm nền mỗi tuần"
          inputMode="numeric"
          value={basePoints}
          disabled={!editable}
          onChange={(event) => setBasePoints(event.target.value)}
        />
        {editable ? (
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Lưu nề nếp
          </Button>
        ) : null}
      </div>
    </section>
  );
}
