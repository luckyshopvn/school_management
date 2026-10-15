// Nhóm lớp, nhóm trẻ, nhóm tuổi của lớp theo hệ thống của Sở (DT-15 phần 15b, YCTD-111; khảo sát mục 3.2 dòng 2.1). Nhóm
// tuổi lưu ở lớp; lớp chưa chọn thì lấy theo tháng tuổi bắt đầu của bậc học như thống kê (`classAgeGroup`). Nhóm lớp suy
// ra từ nhóm tuổi: ba nhóm dưới 36 tháng là nhóm trẻ (nhà trẻ), ba nhóm còn lại là lớp mẫu giáo
export const CLASS_AGE_GROUPS = [
  { key: 'months_3_12', label: '3–12 tháng', stage: 'nhom_tre' },
  { key: 'months_13_24', label: '13–24 tháng', stage: 'nhom_tre' },
  { key: 'months_25_36', label: '25–36 tháng', stage: 'nhom_tre' },
  { key: 'years_3_4', label: '3–4 tuổi', stage: 'mau_giao' },
  { key: 'years_4_5', label: '4–5 tuổi', stage: 'mau_giao' },
  { key: 'years_5_6', label: '5–6 tuổi', stage: 'mau_giao' },
] as const;

export type ClassAgeGroupKey = (typeof CLASS_AGE_GROUPS)[number]['key'];
export type ClassStage = (typeof CLASS_AGE_GROUPS)[number]['stage'];

export const CLASS_STAGE_LABELS: Record<ClassStage, string> = {
  nhom_tre: 'Nhóm trẻ',
  mau_giao: 'Lớp mẫu giáo',
};

export function classStageOf(ageGroup: ClassAgeGroupKey): ClassStage {
  return CLASS_AGE_GROUPS.find((group) => group.key === ageGroup)?.stage ?? 'mau_giao';
}

export function classAgeGroupLabel(ageGroup: ClassAgeGroupKey): string {
  return CLASS_AGE_GROUPS.find((group) => group.key === ageGroup)?.label ?? ageGroup;
}
