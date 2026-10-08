import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SharedColorPicker } from '../../components/ColorPicker/SharedColorPicker';
import { DropCaret, DropdownShell } from './WhiteboardTextControls';

/** Slot tersimpan whiteboard (terpisah dari slot ERD `erd:customColors`). */
export const WHITEBOARD_COLOR_SLOTS_KEY = 'wb:customColors';

/**
 * Custom color picker whiteboard (Opsi B) — wrapper tipis atas shared.
 * Live onPick saat drag; tanpa dialog warna OS.
 */
export function CustomColorPicker({
  value,
  onPick,
}: {
  value: string | null | undefined;
  onPick: (hex: string) => void;
}) {
  return <SharedColorPicker value={value} onPick={onPick} slotsKey={WHITEBOARD_COLOR_SLOTS_KEY} />;
}

/**
 * Tombol rainbow: membuka popover picker custom (Opsi B) — panel swatch
 * tetap murni, dialog OS tidak pernah muncul. Dipakai strip + panel warna.
 */
export function CustomColorButton({
  value,
  onPick,
}: {
  value: string | null | undefined;
  onPick: (hex: string) => void;
}) {
  const { t } = useTranslation('extras');
  const [open, setOpen] = useState(false);
  return (
    <DropdownShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onClose={() => setOpen(false)}
      label={t('whiteboard.colorPanel.custom')}
      popLabel={t('whiteboard.colorPanel.customTitle')}
      button={
        <>
          <span aria-hidden="true" className="wb-rainbow">
            <span aria-hidden="true" className="wb-rainbow-ui" />
          </span>
          <DropCaret />
        </>
      }
    >
      <CustomColorPicker value={value} onPick={onPick} />
    </DropdownShell>
  );
}
