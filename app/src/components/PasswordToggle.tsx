import { Eye, EyeSlash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface PasswordToggleProps {
  show: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ show, onToggle }: PasswordToggleProps) {
  const { t } = useTranslation('account');
  return (
    <button
      type="button"
      className="password-toggle"
      aria-label={show ? t('profile.passwordToggle.hide') : t('profile.passwordToggle.show')}
      onClick={onToggle}
    >
      {show ? (
        <EyeSlash size={14} weight="bold" aria-hidden="true" />
      ) : (
        <Eye size={14} weight="bold" aria-hidden="true" />
      )}
    </button>
  );
}
