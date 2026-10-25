import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Alert, Button, FORM_CONTROL_CLASS, FormBlock, FormRow, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError, fetchCurrentUser, requestJson } from '../session/api-client.js';
import type { StaffDetail } from '../staff/staff-api.js';
import { formatDate } from './SystemAnnouncementsPage.js';
import { TotpPanel } from './TotpPanel.js';

// Hồ sơ nhân sự cá nhân ở menu người dùng (DT-16 phần 16c): xem hồ sơ nhân sự gắn với tài khoản của mình; tự sửa điện
// thoại, thư điện tử, chỗ ở. Các mục khác do người quản lý nhân sự cập nhật ở 3.1.1 Hồ sơ cán bộ, giáo viên
const readOwnStaff = (): Promise<StaffDetail> => requestJson('/api/v1/staff/me');
const saveOwnContact = (contact: { phone: string; email: string; address: string }): Promise<StaffDetail> =>
  requestJson('/api/v1/staff/me/contact', { method: 'PATCH', body: JSON.stringify(contact) });

const GENDER_LABELS = { male: 'Nam', female: 'Nữ' } as const;

function ReadOnly({ children }: { children: ReactNode }) {
  return <p className="py-2 text-content text-text">{children || '—'}</p>;
}

export function MyProfilePage() {
  const queryClient = useQueryClient();
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const staff = useQuery({ queryKey: ['my-staff-profile'], queryFn: readOwnStaff, retry: false });
  const [contact, setContact] = useState({ phone: '', email: '', address: '' });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  useEffect(() => {
    if (staff.data) {
      setContact({
        phone: staff.data.phone ?? '',
        email: staff.data.email ?? '',
        address: staff.data.address ?? '',
      });
    }
  }, [staff.data]);
  const save = useMutation({
    mutationFn: () => saveOwnContact(contact),
    onSuccess: (saved) => {
      queryClient.setQueryData(['my-staff-profile'], saved);
      setToastMessage('Đã ghi thông tin liên hệ');
    },
  });
  const fieldError = (field: string) =>
    save.error instanceof ApiError ? save.error.details.find((detail) => detail.field === field)?.message : undefined;
  const notLinked = staff.error instanceof ApiError && staff.error.status === 404;
  const profile = staff.data;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex max-w-4xl flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Hồ sơ nhân sự cá nhân</h1>
        <FormBlock title="Tài khoản">
          <FormRow label="Họ và tên">
            <ReadOnly>{currentUser.data?.full_name}</ReadOnly>
          </FormRow>
          <FormRow label="Tên đăng nhập">
            <ReadOnly>{currentUser.data?.username}</ReadOnly>
          </FormRow>
          <FormRow label="Số điện thoại đăng nhập">
            <ReadOnly>{currentUser.data?.phone}</ReadOnly>
          </FormRow>
          <FormRow label="Vai trò">
            <ReadOnly>{currentUser.data?.assignments.map((assignment) => assignment.role_name).join(', ')}</ReadOnly>
          </FormRow>
          <div>
            <Link to="/change-password" className="text-label font-medium text-link hover:underline">
              Đổi mật khẩu
            </Link>
          </div>
        </FormBlock>
        {notLinked ? (
          <Alert tone="info">
            Tài khoản chưa gắn với hồ sơ nhân sự. Liên hệ người quản lý nhân sự của trường để gắn tài khoản.
          </Alert>
        ) : staff.error ? (
          <Alert tone="danger">
            {staff.error instanceof ApiError ? staff.error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'}
          </Alert>
        ) : null}
        {profile ? (
          <>
            <FormBlock title="Thông tin nhân sự">
              <FormRow label="Mã nhân sự">
                <ReadOnly>{profile.code}</ReadOnly>
              </FormRow>
              <FormRow label="Mã định danh Bộ GD&ĐT">
                <ReadOnly>{profile.moet_staff_code}</ReadOnly>
              </FormRow>
              <FormRow label="Họ và tên">
                <ReadOnly>{profile.full_name}</ReadOnly>
              </FormRow>
              <FormRow label="Ngày sinh">
                <ReadOnly>{formatDate(profile.dob)}</ReadOnly>
              </FormRow>
              <FormRow label="Giới tính">
                <ReadOnly>{profile.gender ? GENDER_LABELS[profile.gender] : ''}</ReadOnly>
              </FormRow>
              <FormRow label="Số định danh cá nhân">
                <ReadOnly>{profile.id_number_masked}</ReadOnly>
              </FormRow>
              <FormRow label="Đơn vị">
                <ReadOnly>{profile.unit_name}</ReadOnly>
              </FormRow>
              <FormRow label="Tổ chuyên môn, phòng ban">
                <ReadOnly>{profile.department_name}</ReadOnly>
              </FormRow>
              <FormRow label="Chức danh">
                <ReadOnly>{profile.job_title_name}</ReadOnly>
              </FormRow>
              <FormRow label="Ngày vào làm">
                <ReadOnly>{formatDate(profile.start_date)}</ReadOnly>
              </FormRow>
            </FormBlock>
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <FormBlock title="Thông tin liên hệ">
                {save.error && !(save.error instanceof ApiError && save.error.details.length > 0) ? (
                  <Alert tone="danger">
                    {save.error instanceof ApiError
                      ? save.error.message
                      : 'Không kết nối được tới máy chủ, vui lòng thử lại'}
                  </Alert>
                ) : null}
                <FormRow label="Điện thoại" error={fieldError('phone')}>
                  <input
                    className={FORM_CONTROL_CLASS}
                    inputMode="tel"
                    value={contact.phone}
                    onChange={(event) => setContact({ ...contact, phone: event.target.value })}
                  />
                </FormRow>
                <FormRow label="Thư điện tử" error={fieldError('email')}>
                  <input
                    className={FORM_CONTROL_CLASS}
                    type="email"
                    value={contact.email}
                    onChange={(event) => setContact({ ...contact, email: event.target.value })}
                  />
                </FormRow>
                <FormRow label="Chỗ ở hiện nay" error={fieldError('address')}>
                  <input
                    className={FORM_CONTROL_CLASS}
                    value={contact.address}
                    onChange={(event) => setContact({ ...contact, address: event.target.value })}
                  />
                </FormRow>
              </FormBlock>
              <div>
                <Button type="submit" variant="primary" disabled={save.isPending}>
                  Ghi
                </Button>
              </div>
            </form>
          </>
        ) : null}
        <TotpPanel />
      </div>
    </AppShell>
  );
}
