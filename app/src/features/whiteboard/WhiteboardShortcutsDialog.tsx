import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/Modal';
import { SHORTCUTS } from './shortcuts';

interface WhiteboardShortcutsDialogProps {
  onClose: () => void;
}

const mod = (s: string) => s.replaceAll('Mod', 'Ctrl');

interface Row {
  keys: string[];
  label: string;
}

/**
 * Keyboard shortcut cheatsheet for the whiteboard canvas (? key).
 * Single source of truth lives in SHORTCUTS; labels reuse canvas strings.
 */
export function WhiteboardShortcutsDialog({ onClose }: WhiteboardShortcutsDialogProps) {
  const { t } = useTranslation('extras');
  const tool = (key: string) => t(`whiteboard.tool.${key}`);
  const toolRow = (key: string, labelKey: string) => ({
    keys: [key.toUpperCase()],
    label: tool(labelKey),
  });
  const sections: Array<{ title: string; rows: Row[] }> = [
    {
      title: t('whiteboard.shortcuts.tools'),
      rows: [
        { keys: [SHORTCUTS.select.toUpperCase()], label: tool('select') },
        { keys: [SHORTCUTS.view.toUpperCase()], label: tool('view') },
        { keys: [SHORTCUTS.marquee.toUpperCase()], label: tool('marquee') },
        toolRow(SHORTCUTS.pen, 'pen'),
        toolRow(SHORTCUTS.eraser, 'eraser'),
        toolRow(SHORTCUTS.text, 'text'),
        toolRow(SHORTCUTS.sticky, 'sticky'),
        toolRow(SHORTCUTS.shape, 'shape'),
        toolRow(SHORTCUTS.edge, 'edge'),
        toolRow(SHORTCUTS.ref, 'ref'),
        { keys: [SHORTCUTS.boundary], label: tool('boundary') },
        { keys: [SHORTCUTS.pan], label: t('whiteboard.shortcuts.panHold') },
      ],
    },
    {
      title: t('whiteboard.shortcuts.edit'),
      rows: [
        { keys: [mod(SHORTCUTS.undo)], label: t('whiteboard.toolbar.undoTitle') },
        { keys: [mod(SHORTCUTS.redo), mod(SHORTCUTS.redoAlt)], label: t('whiteboard.toolbar.redoTitle') },
        { keys: [mod(SHORTCUTS.cut)], label: t('whiteboard.ctx.cut') },
        { keys: [mod(SHORTCUTS.copy)], label: t('whiteboard.ctx.copy') },
        { keys: [mod(SHORTCUTS.paste)], label: t('whiteboard.ctx.paste') },
        { keys: [mod(SHORTCUTS.pasteReplace)], label: t('whiteboard.ctx.pasteReplace') },
        { keys: [mod(SHORTCUTS.duplicate)], label: t('whiteboard.ctx.duplicate') },
        { keys: [SHORTCUTS.delete], label: t('whiteboard.canvas.deleteSelected') },
        { keys: [mod('Mod+A')], label: t('whiteboard.shortcuts.selectAll') },
        { keys: [mod(SHORTCUTS.bold)], label: t('whiteboard.textbar.bold') },
        { keys: [SHORTCUTS.editText], label: t('whiteboard.shortcuts.editText') },
        { keys: [SHORTCUTS.nudge], label: t('whiteboard.shortcuts.nudge') },
        { keys: [SHORTCUTS.nudgeBig], label: t('whiteboard.shortcuts.nudgeBig') },
      ],
    },
    {
      title: t('whiteboard.shortcuts.arrange'),
      rows: [
        { keys: [mod(SHORTCUTS.group)], label: t('whiteboard.canvas.group') },
        { keys: [mod(SHORTCUTS.ungroup)], label: t('whiteboard.canvas.ungroup') },
        { keys: [mod(SHORTCUTS.bringForward)], label: t('whiteboard.canvas.bringForward') },
        { keys: [mod(SHORTCUTS.sendBackward)], label: t('whiteboard.canvas.sendBackward') },
        { keys: [mod(SHORTCUTS.bringFront)], label: t('whiteboard.ctx.bringFront') },
        { keys: [mod(SHORTCUTS.sendBack)], label: t('whiteboard.ctx.sendBack') },
      ],
    },
    {
      title: t('whiteboard.shortcuts.view'),
      rows: [
        { keys: [mod(SHORTCUTS.zoomIn)], label: t('whiteboard.shortcuts.zoomIn') },
        { keys: [mod(SHORTCUTS.zoomOut)], label: t('whiteboard.shortcuts.zoomOut') },
        { keys: [mod(SHORTCUTS.zoomReset)], label: t('whiteboard.shortcuts.zoomReset') },
        { keys: ['F'], label: t('whiteboard.toolbar.canvasMode') },
        { keys: [SHORTCUTS.help], label: t('whiteboard.shortcuts.help') },
        { keys: [SHORTCUTS.escape], label: t('whiteboard.shortcuts.dismiss') },
      ],
    },
  ];
  return (
    <Modal open title={t('whiteboard.shortcuts.title')} onClose={onClose} width="md">
      <div className="wb-shortcuts">
        {sections.map((sec) => (
          <div key={sec.title} className="wb-shortcuts-sec">
            <div className="wb-shortcuts-head">{sec.title}</div>
            {sec.rows.map((row) => (
              <div key={row.label} className="wb-shortcuts-row">
                <span className="wb-shortcuts-keys">
                  {row.keys.map((k) => (
                    <kbd key={k} className="wb-shortcut-key tabular">
                      {k}
                    </kbd>
                  ))}
                </span>
                <span className="wb-shortcuts-text">{row.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
