import { useId, type InputHTMLAttributes } from 'react';

// Ô nhập có nhãn phía trên, thông báo lỗi phía dưới, không dùng chỗ giữ chỗ làm nhãn (TD-02)
export interface TextFieldProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
}

export function TextField({ label, error, className = '', ...properties }: TextFieldProperties) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={inputId} className="text-label font-medium text-text">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-lg border bg-card px-3 py-2 text-content text-text outline-none focus:border-border-strong focus:ring-2 focus:ring-selected ${error ? 'border-danger' : 'border-border'}`}
        {...properties}
      />
      {error ? (
        <p id={errorId} className="text-label text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
