import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link as RouterLink, type LinkProps } from 'react-router';

type LinkButtonBase = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md';
  /** Ikon dekoratif — dibungkus `btn-icon-wrap` seperti `Button`. */
  leftIcon?: ReactNode;
  /** Posisi ikon: depan (default) atau belakang (mis. CTA publik panah 11px). */
  iconPosition?: 'left' | 'right';
  children: ReactNode;
  className?: string;
};

export type LinkButtonProps = LinkButtonBase &
  (
    | ({ to: string; replace?: boolean } & Omit<
        LinkProps,
        'to' | 'replace' | 'children' | 'className'
      >)
    | ({ href: string; 'data-external'?: string | boolean } & Omit<
        AnchorHTMLAttributes<HTMLAnchorElement>,
        'href' | 'children' | 'className'
      >)
  );

/**
 * Link berbaju tombol kanonis (Tier-1, §9: link-btn WAJIB size):
 * navigasi internal (`to`, react-router) vs eksternal (`href`, anchor)
 * sebagai union eksplisit — bukan boolean mode. `rel` default
 * `noopener noreferrer` bila `target="_blank"` tanpa `rel` eksplisit.
 */
export function LinkButton(props: LinkButtonProps) {
  const {
    variant = 'secondary',
    size = 'sm',
    leftIcon,
    iconPosition = 'left',
    children,
    className,
    ...rest
  } = props;
  const cls = `btn btn-${variant} btn-${size}${className ? ` ${className}` : ''}`;
  const icon = leftIcon ? (
    <span aria-hidden="true" className="btn-icon-wrap">
      {leftIcon}
    </span>
  ) : null;
  const content = (
    <>
      {iconPosition === 'left' ? icon : null}
      {children}
      {iconPosition === 'right' ? icon : null}
    </>
  );
  if ('to' in rest) {
    const { to, replace, ...linkRest } = rest;
    return (
      <RouterLink to={to} replace={replace} className={cls} {...linkRest}>
        {content}
      </RouterLink>
    );
  }
  const { href, target, rel, ...anchorRest } = rest;
  return (
    <a
      href={href}
      target={target}
      rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)}
      className={cls}
      {...anchorRest}
    >
      {content}
    </a>
  );
}
