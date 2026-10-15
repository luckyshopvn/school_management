import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OFFICE_ACCOUNT_FIELDS,
  OFFICE_ACCOUNTS_SECTION,
  PERMISSION_CODES,
  SCHOOL_PROFILE_SECTIONS,
} from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  fieldErrorsOf,
  messageOf,
  readSchoolProfile,
  saveSchoolProfile,
  type ProfileValues,
  type SchoolProfile,
} from './facilities-api.js';
import { ProfileFieldInput, TabBar } from './facilities-ui.js';

// 1.1 Hồ sơ trường (YCTD-102): sáu thẻ, nút Ghi lưu cả sáu thẻ; chỉ Hiệu trưởng (phạm vi toàn trường) ghi được
type SectionKey = 'general' | 'other_info' | 'foreign_elements' | 'internet' | 'it_infrastructure';
type TabKey = SectionKey | 'office_accounts';
type Draft = Record<SectionKey, ProfileValues> & { office_accounts: ProfileValues[] };

const TABS: Array<{ key: TabKey; label: string }> = [
  ...SCHOOL_PROFILE_SECTIONS.map((section) => ({ key: section.key as TabKey, label: section.label })),
  { key: OFFICE_ACCOUNTS_SECTION.key, label: OFFICE_ACCOUNTS_SECTION.label },
];

const draftOf = (profile: SchoolProfile): Draft => ({
  general: profile.general,
  other_info: profile.other_info,
  foreign_elements: profile.foreign_elements,
  internet: profile.internet,
  it_infrastructure: profile.it_infrastructure,
  office_accounts: profile.office_accounts,
});

export function SchoolProfilePage() {
  const canManage = useHasPermission(PERMISSION_CODES.schoolProfileManage);
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['school-profile'], queryFn: readSchoolProfile });
  const [tab, setTab] = useState<TabKey>('general');
  const [draft, setDraft] = useState<Draft>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  useEffect(() => {
    if (profile.data) {
      setDraft(draftOf(profile.data));
    }
  }, [profile.data]);
  const save = useMutation({
    mutationFn: () => saveSchoolProfile(draft as Draft),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['school-profile'], saved);
      setToastMessage('Đã ghi hồ sơ trường');
    },
  });
  const errors = fieldErrorsOf(save.error);
  const section = SCHOOL_PROFILE_SECTIONS.find((item) => item.key === tab);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-page-title font-bold text-text">{menuPageTitle('/school-profile')}</h1>
          {canManage && draft ? (
            <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
              Ghi
            </Button>
          ) : null}
        </div>
        {profile.data ? (
          <p className="text-content text-text-secondary">
            Trường chính: {profile.data.org_unit.name}. Hồ sơ lưu theo năm học, mở năm học mới thì chuyển sang năm mới.
          </p>
        ) : null}
        {profile.error ? <Alert tone="danger">{messageOf(profile.error)}</Alert> : null}
        {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
        <TabBar<TabKey> tabs={TABS} current={tab} onSelect={setTab} label="Thẻ hồ sơ trường" />
        {draft && section ? (
          <section
            className={`grid gap-4 rounded-xl border border-border bg-card p-4 ${
              section.fields.every((field) => field.kind === 'boolean') ? 'md:grid-cols-3' : 'md:grid-cols-2'
            }`}
            aria-label={section.label}
          >
            {section.fields.map((field) => (
              <ProfileFieldInput
                key={field.key}
                field={field}
                value={draft[section.key as SectionKey][field.key]}
                error={errors[`${section.key}.${field.key}`]}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    [section.key]: { ...draft[section.key as SectionKey], [field.key]: value },
                  })
                }
              />
            ))}
          </section>
        ) : null}
        {draft && tab === 'office_accounts' ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label={OFFICE_ACCOUNTS_SECTION.label}
          >
            <p className="text-content text-text-secondary">Không lưu mật khẩu của tài khoản.</p>
            {draft.office_accounts.map((account, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-5">
                {OFFICE_ACCOUNT_FIELDS.map((field) => (
                  <ProfileFieldInput
                    key={field.key}
                    field={field}
                    value={account[field.key]}
                    error={errors[`office_accounts.${index}.${field.key}`]}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        office_accounts: draft.office_accounts.map((item, position) =>
                          position === index ? { ...item, [field.key]: value } : item,
                        ),
                      })
                    }
                  />
                ))}
                <div className="flex items-end">
                  <Button
                    variant="text"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        office_accounts: draft.office_accounts.filter((_item, position) => position !== index),
                      })
                    }
                  >
                    Xóa dòng
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button
                variant="secondary"
                onClick={() => setDraft({ ...draft, office_accounts: [...draft.office_accounts, {}] })}
              >
                Thêm tài khoản
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
