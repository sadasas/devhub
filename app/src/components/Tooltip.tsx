import { cloneElement, isValidElement, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode, Ref } from 'react';
import {
  FloatingArrow,
  FloatingPortal,
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
} from '@floating-ui/react';
import type { Placement } from '@floating-ui/react';

export type TooltipTone = 'dark' | 'light' | 'info';
export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
export type TooltipAlign = 'start' | 'center' | 'end';

export interface TooltipCardProps {
  tone?: TooltipTone;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  media?: ReactNode;
  className?: string;
  id?: string;
  children?: ReactNode;
}

/**
 * Totem tampilan tooltip — dipakai langsung (ERD canvas, konten kustom)
 * maupun di dalam <Tooltip> interaktif.
 */
export function TooltipCard({
  tone = 'dark',
  title,
  description,
  icon,
  media,
  className = '',
  id,
  children,
}: TooltipCardProps) {
  return (
    <div id={id} className={`tooltip-card tooltip-card-${tone}${className ? ` ${className}` : ''}`}>
      {media && (
        <div className="tooltip-media" aria-hidden={title !== undefined || description !== undefined}>
          {media}
        </div>
      )}
      <div className="tooltip-body">
        {icon && (
          <span className="tooltip-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="tooltip-text">
          {title !== undefined && <span className="tooltip-title">{title}</span>}
          {description !== undefined && <span className="tooltip-desc">{description}</span>}
          {children}
        </span>
      </div>
    </div>
  );
}

export interface TooltipProps extends Omit<TooltipCardProps, 'className' | 'id'> {
  /** Delay buka saat hover (ms). Default 150 mengikuti tooltip pill whiteboard. */
  delay?: number;
  side?: TooltipSide;
  align?: TooltipAlign;
  disabled?: boolean;
  /** Class untuk pembungkus trigger (mode wrap saja). */
  triggerClassName?: string;
  children: ReactElement;
}

function toPlacement(side: TooltipSide, align: TooltipAlign): Placement {
  if (align === 'center') return side;
  return `${side}-${align}` as Placement;
}

/**
 * Tooltip reusable global — hover + fokus + Esc, posisi via floating-ui
 * (flip/shift/arrow otomatis). Trigger elemen DOM di-clone langsung
 * (tanpa node ekstra); komponen komposit / tombol disabled dibungkus span.
 */
export function Tooltip({
  content,
  title,
  description,
  icon,
  media,
  children,
  tone = 'dark',
  side = 'top',
  align = 'center',
  delay = 150,
  disabled = false,
  triggerClassName = '',
}: TooltipProps & { content?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const arrowRef = useRef<SVGSVGElement | null>(null);
  const tooltipId = useId();

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: toPlacement(side, align),
    strategy: 'fixed',
    middleware: [offset(8), flip(), shift({ padding: 8 }), arrow({ element: arrowRef })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { enabled: !disabled, delay: { open: delay, close: 0 }, move: false });
  const focus = useFocus(context, { enabled: !disabled });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  const hasBody =
    content !== undefined || title !== undefined || description !== undefined || icon !== undefined || media !== undefined;
  const show = open && !disabled && hasBody;

  const floating = show ? (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        className="tooltip-float"
        style={{ ...floatingStyles, zIndex: 80 } as CSSProperties}
        {...getFloatingProps()}
      >
        <TooltipCard tone={tone} title={title} description={description} icon={icon} media={media} id={tooltipId}>
          {content}
        </TooltipCard>
        <FloatingArrow ref={arrowRef} context={context} className={`tooltip-arrow tooltip-arrow-${tone}`} />
      </div>
    </FloatingPortal>
  ) : null;

  const childProps = isValidElement(children) ? (children.props as Record<string, unknown>) : {};
  const isHost = isValidElement(children) && typeof children.type === 'string';
  const isDisabledHost = isHost && (childProps as { disabled?: unknown }).disabled === true;
  const childRef = isValidElement(children)
    ? (children.props as { ref?: Ref<HTMLElement> }).ref
    : undefined;
  const mergedRef = useMergeRefs([refs.setReference, childRef]);
  const useClone = isHost && !isDisabledHost && isValidElement(children);

  // Elemen DOM non-disabled → clone: tanpa node pembungkus ekstra (grid/flex utuh).
  if (useClone) {
    const refProps = getReferenceProps();
    const merged: Record<string, unknown> = { ...refProps, ref: mergedRef };
    for (const [key, value] of Object.entries(refProps)) {
      if (key === 'ref') continue;
      if (key.startsWith('on') && typeof value === 'function' && typeof childProps[key] === 'function') {
        const childFn = childProps[key] as (...args: never[]) => void;
        const tipFn = value as (...args: never[]) => void;
        merged[key] = (...args: never[]) => {
          childFn(...args);
          tipFn(...args);
        };
      }
    }
    if (merged['aria-describedby'] !== undefined && childProps['aria-describedby'] !== undefined) {
      merged['aria-describedby'] = `${childProps['aria-describedby']} ${tooltipId}`;
    } else if (merged['aria-describedby'] === undefined && childProps['aria-describedby'] === undefined) {
      merged['aria-describedby'] = tooltipId;
    }
    (merged as Record<string, unknown>)['data-tooltip-open'] = open || undefined;
    return (
      <>
        {cloneElement(children as ReactElement<Record<string, unknown>>, merged)}
        {floating}
      </>
    );
  }

  // Komposit / disabled → bungkus span (event tak jalan di tombol disabled).
  return (
    <>
      <span
        ref={refs.setReference}
        className={`tooltip-ref${triggerClassName ? ` ${triggerClassName}` : ''}`}
        data-tooltip-open={open || undefined}
        {...getReferenceProps()}
      >
        {children}
      </span>
      {floating}
    </>
  );
}
