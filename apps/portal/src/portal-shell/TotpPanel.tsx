import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Xác thực hai lớp của tài khoản (DT-SaaS phần S8b, YCTD-201): hiện ở Hồ sơ của tôi khi trường đã bật. Đăng ký bằng khóa hoặc địa chỉ nhập vào
// ứng dụng xác thực (Google Authenticator, Microsoft Authenticator, Authy), xác nhận mã đầu tiên thì bật và nhận mã khôi phục (chỉ hiện một
// lần); tắt bằng một mã hiện tại hoặc mã khôi phục
interface TotpStatus {
  feature_enabled: boolean;
  enrolled: boolean;
  pending_setup: boolean;
  recovery_codes_left: number;
}

interface TotpSetup {
  secret: string;
  otpauth_uri: string;
}

const send = <T,>(method: string, path: string, body?: unknown) =>
  requestJson<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function TotpPanel() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['totp-status'],
    queryFn: () => requestJson<TotpStatus>('/api/v1/auth/totp'),
    retry: false,
  });
  const [setup, setSetup] = useState<TotpSetup>();
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['totp-status'] });
  const begin = useMutation({
    mutationFn: () => send<TotpSetup>('POST', '/api/v1/auth/totp/setup'),
    onSuccess: (result) => {
      setSetup(result);
      setCode('');
    },
  });
  const confirm = useMutation({
    mutationFn: () => send<{ recovery_codes: string[] }>('POST', '/api/v1/auth/totp/confirm', { code }),
    onSuccess: async (result) => {
      setRecoveryCodes(result.recovery_codes);
      setSetup(undefined);
      setCode('');
      await refresh();
    },
  });
  const disable = useMutation({
    mutationFn: () => send('POST', '/api/v1/auth/totp/disable', { code }),
    onSuccess: async () => {
      setCode('');
      setRecoveryCodes(undefined);
      await refresh();
    },
  });
  if (!status.data?.feature_enabled) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Xác thực hai lớp">
      <h2 className="text-section-title font-semibold text-text">Xác thực hai lớp</h2>
      {status.data.enrolled ? (
        <>
          <p className="text-content text-text">
            Đang bật. Còn {status.data.recovery_codes_left} mã khôi phục chưa dùng. Khi đăng nhập, nhập thêm mã 6 số từ
            ứng dụng xác thực.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              label="Mã hiện tại hoặc mã khôi phục để tắt"
              value={code}
              autoComplete="one-time-code"
              onChange={(event) => setCode(event.target.value)}
            />
            <Button variant="secondary" disabled={!code.trim() || disable.isPending} onClick={() => disable.mutate()}>
              Tắt xác thực hai lớp
            </Button>
          </div>
        </>
      ) : setup ? (
        <>
          <p className="text-content text-text">
            Thêm tài khoản vào ứng dụng xác thực bằng khóa dưới đây (loại theo thời gian), rồi nhập mã 6 số ứng dụng
            hiện ra.
          </p>
          <p className="break-all font-mono text-content text-text" data-testid="totp-secret">
            {setup.secret}
          </p>
          <p className="break-all text-label text-text-secondary">Hoặc mở địa chỉ: {setup.otpauth_uri}</p>
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              label="Mã 6 số"
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(event) => setCode(event.target.value)}
            />
            <Button variant="primary" disabled={!code.trim() || confirm.isPending} onClick={() => confirm.mutate()}>
              Xác nhận và bật
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-content text-text">
            Chưa bật. Bật để đăng nhập cần thêm mã từ ứng dụng xác thực trên điện thoại.
          </p>
          <div>
            <Button variant="primary" disabled={begin.isPending} onClick={() => begin.mutate()}>
              Bật xác thực hai lớp
            </Button>
          </div>
        </>
      )}
      {recoveryCodes ? (
        <Alert tone="success">
          Mã khôi phục (chỉ hiện một lần, mỗi mã dùng một lần khi mất điện thoại; hãy lưu ở nơi an toàn):{' '}
          <span className="font-mono" data-testid="totp-recovery-codes">
            {recoveryCodes.join('  ')}
          </span>
        </Alert>
      ) : null}
      {[begin.error, confirm.error, disable.error].filter(Boolean).map((error, index) => (
        <Alert key={index} tone="danger">
          {messageOf(error)}
        </Alert>
      ))}
    </section>
  );
}
