import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { newId, nowIso } from '../../lib/utils';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { WHITEBOARD_TEMPLATES } from './templates';

const MAX_BOARDS = 50;

interface NewWhiteboardModalProps {
  onClose: () => void;
}

export function NewWhiteboardModal({ onClose }: NewWhiteboardModalProps) {
  const { t } = useTranslation('extras');
  const { state, dispatch, canEdit } = useProject();
  usePresenceStatus(t('whiteboard.newModal.presence'));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('blank');
  const atCap = (state?.whiteboards.length ?? 0) >= MAX_BOARDS;

  const submit = () => {
    if (!canEdit) return;
    if (!name.trim() || atCap) return;
    const template = WHITEBOARD_TEMPLATES.find((t) => t.id === templateId) ?? WHITEBOARD_TEMPLATES[0]!;
    const ts = nowIso();
    dispatch({
      type: 'whiteboard/add',
      whiteboard: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        description: description.trim(),
        elements: template.build(),
      },
    });
    onClose();
  };

  return (
    <Modal
      open
      title={t('whiteboard.newModal.title')}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('whiteboard.newModal.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canEdit || !name.trim() || atCap}>
            {t('whiteboard.newModal.create')}
          </Button>
        </>
      }
    >
      <div className="form-stack">
        {atCap && <p className="field-helper">{t('whiteboard.newModal.capHelper', { max: MAX_BOARDS })}</p>}
        <Input
          label={t('whiteboard.newModal.name')}
          required
          autoFocus
          maxLength={300}
          showCount
          placeholder={t('whiteboard.newModal.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <fieldset className="wb-template-grid">
          <legend>{t('whiteboard.newModal.templateLegend')}</legend>
          {WHITEBOARD_TEMPLATES.map((tpl) => (
            <label
              key={tpl.id}
              className={`wb-template-option${templateId === tpl.id ? ' wb-template-option-active' : ''}`}
            >
              <input
                type="radio"
                name="wb-template"
                value={tpl.id}
                checked={templateId === tpl.id}
                onChange={() => setTemplateId(tpl.id)}
              />
              <span className="wb-template-name">{t(`whiteboard.template.${tpl.id}.name`)}</span>
              <span className="wb-template-desc">{t(`whiteboard.template.${tpl.id}.desc`)}</span>
            </label>
          ))}
        </fieldset>
        <Textarea
          label={t('whiteboard.newModal.description')}
          rows={3}
          maxLength={2000}
          helper={t('whiteboard.newModal.descHelper')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}