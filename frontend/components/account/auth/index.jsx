import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import {
  Checkbox,
  Input,
  PasswordInput,
  ProgressBar,
} from '../../ui';
import SectionCard from '../_shared/SectionCard';

export function RememberMeCheckbox({ checked, onChange, disabled }) {
  return (
    <Checkbox
      name="rememberMe"
      label="Remember me"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export function SocialLoginButtons({ onGoogle, onGitHub, disabled }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Button
        variant="outline"
        onClick={onGoogle}
        disabled={disabled}
        className="justify-center flex"
      >
        <span className="inline-flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.774 32.656 29.294 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.19 0 9.897-1.99 13.446-5.223l-6.214-5.26C29.12 35.144 26.682 36 24 36c-5.273 0-9.74-3.316-11.288-7.946l-6.522 5.025C9.504 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.07 12.07 0 01-4.071 5.517h.003l6.214 5.26C36.99 39.197 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Continue with Google
        </span>
      </Button>
      <Button
        variant="outline"
        onClick={onGitHub}
        disabled={disabled}
        className="justify-center flex"
      >
        <span className="inline-flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.86 3.16 8.98 7.55 10.43.55.1.75-.24.75-.52v-1.85c-3.07.67-3.71-1.31-3.71-1.31-.5-1.27-1.22-1.6-1.22-1.6-1-.69.07-.68.07-.68 1.1.08 1.68 1.14 1.68 1.14.99 1.69 2.6 1.2 3.23.92.1-.72.39-1.2.7-1.47-2.45-.28-5.02-1.23-5.02-5.47 0-1.2.43-2.18 1.13-2.95-.12-.28-.5-1.41.1-2.94 0 0 .92-.3 3.02 1.12a10.4 10.4 0 012.75-.37c.93 0 1.87.13 2.75.37 2.1-1.42 3.02-1.12 3.02-1.12.6 1.53.22 2.66.1 2.94.7.77 1.13 1.75 1.13 2.95 0 4.25-2.57 5.18-5.03 5.45.4.35.75 1.03.75 2.08v3.08c0 .29.2.63.76.52 4.39-1.45 7.55-5.57 7.55-10.43C23.25 5.48 18.27.5 12 .5z"/>
          </svg>
          Continue with GitHub
        </span>
      </Button>
    </div>
  );
}

export function TwoFactorCodeInput({ length = 6, value = '', onChange, disabled }) {
  const refs = useRef([]);

  const digits = useMemo(() => {
    const v = String(value || '').replace(/\D/g, '').slice(0, length);
    return Array.from({ length }, (_, i) => v[i] || '');
  }, [value, length]);

  const setAt = (idx, nextDigit) => {
    const next = digits.slice();
    next[idx] = nextDigit;
    const joined = next.join('');
    onChange?.(joined);
  };

  return (
    <div className="flex items-center gap-2">
      {digits.map((d, idx) => (
        <input
          key={idx}
          ref={(el) => (refs.current[idx] = el)}
          inputMode="numeric"
          autoComplete="one-time-code"
          disabled={disabled}
          value={d}
          onChange={(e) => {
            const nd = e.target.value.replace(/\D/g, '').slice(-1);
            setAt(idx, nd);
            if (nd && refs.current[idx + 1]) refs.current[idx + 1].focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[idx] && refs.current[idx - 1]) refs.current[idx - 1].focus();
          }}
          className="h-11 w-11 rounded-md border border-gray-300 text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      ))}
    </div>
  );
}

export function TwoFactorVerificationInput({
  value,
  onChange,
  onVerify,
  loading,
  error,
}) {
  return (
    <SectionCard title="Two-Factor Verification" subtitle="Enter the 6-digit code from your authenticator app.">
      <div className="space-y-4">
        <TwoFactorCodeInput value={value} onChange={onChange} />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <Button onClick={() => onVerify?.(value)} loading={loading} disabled={!value || String(value).length < 6}>
          Verify
        </Button>
      </div>
    </SectionCard>
  );
}

export function TwoFactorSetup({
  issuer = 'Fintranzact',
  accountName = 'your@email.com',
  progress = 33,
  qrPlaceholderText = 'QR Code',
  onContinue,
}) {
  return (
    <SectionCard title="Set up Two-Factor Authentication" subtitle="Add an extra layer of security to your account.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <ProgressBar value={progress} label="Setup progress" />
          <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
            <li>Install an authenticator app (Google Authenticator, Authy, etc.).</li>
            <li>Scan the QR code with your app.</li>
            <li>Enter the verification code to finish.</li>
          </ol>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <div className="font-semibold">Account</div>
            <div className="mt-1">Issuer: {issuer}</div>
            <div>Login: {accountName}</div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center justify-center">
          <div className="h-40 w-40 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700 font-semibold">
            {qrPlaceholderText}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </SectionCard>
  );
}

export function SessionExpiredModal({ isOpen, onClose, onReLogin }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Session expired" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Your session has expired for security reasons. Please sign in again.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onReLogin}>Sign in</Button>
        </div>
      </div>
    </Modal>
  );
}

export function MagicLinkLogin({ onSendLink, loading, message }) {
  const [email, setEmail] = useState('');

  return (
    <SectionCard title="Magic link login" subtitle="We’ll email you a sign-in link.">
      <div className="space-y-4">
        <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button onClick={() => onSendLink?.(email)} loading={loading} disabled={!email}>
          Send link
        </Button>
        {message ? <div className="text-sm text-gray-600">{message}</div> : null}
      </div>
    </SectionCard>
  );
}

export function LoginForm({
  onSubmit,
  loading,
  error,
  showRememberMe = true,
  initialEmail = '',
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => setEmail(initialEmail || ''), [initialEmail]);

  return (
    <SectionCard title="Sign in" subtitle="Welcome back — please enter your details.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.({ email, password, rememberMe });
        }}
      >
        <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput label="Password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {showRememberMe ? (
          <RememberMeCheckbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
        ) : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <Button type="submit" loading={loading} className="w-full justify-center flex">
          Sign in
        </Button>
      </form>
    </SectionCard>
  );
}

export function RegistrationSignupForm({ onSubmit, loading, error }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SectionCard title="Create your account" subtitle="Start your Fintranzact workspace in seconds.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.({ name, email, password });
        }}
      >
        <Input label="Full name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput label="Password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <Button type="submit" loading={loading} className="w-full justify-center flex">
          Create account
        </Button>
      </form>
    </SectionCard>
  );
}

export function PasswordResetForm({ onSubmit, loading, message, error }) {
  const [email, setEmail] = useState('');

  return (
    <SectionCard title="Reset password" subtitle="We’ll email you a reset link.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.({ email });
        }}
      >
        <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <Button type="submit" loading={loading} disabled={!email}>
          Send reset link
        </Button>
        {message ? <div className="text-sm text-gray-600">{message}</div> : null}
      </form>
    </SectionCard>
  );
}
