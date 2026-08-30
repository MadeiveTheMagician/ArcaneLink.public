import { type CSSProperties, useEffect, useState } from 'react';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent
} from '@dnd-kit/core';

import { SystemIcon, commonCopy, serverCopy } from '../../../shared';
import { SystemIconButton } from '../../../shared/ui/SystemIconButton';
import type { MessageAttachmentDraft } from './messageAttachmentDraft';
import { formatFileSize } from './messageUtils';

import styles from './MessageAttachmentDraftList.module.css';

type Props = {
  attachments: MessageAttachmentDraft[];
  disabled: boolean;
  onChange: (attachments: MessageAttachmentDraft[]) => void;
};

export function MessageAttachmentDraftList({
  attachments,
  disabled,
  onChange
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] =
    useState<AttachmentDropIndicator | null>(null);
  const editingAttachment =
    attachments.find((item) => item.id === editingId) ?? null;

  function updateAttachment(
    id: string,
    patch: Partial<MessageAttachmentDraft>
  ) {
    onChange(
      attachments.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setDropIndicator(getAttachmentDropIndicator(attachments, activeId, overId));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setDraggedId(null);
    setDropIndicator(null);

    if (!overId || activeId === overId) return;
    const fromIndex = attachments.findIndex((item) => item.id === activeId);
    const toIndex = attachments.findIndex((item) => item.id === overId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...attachments];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  }

  function cancelDrag() {
    setDraggedId(null);
    setDropIndicator(null);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={attachmentCollisionDetection}
        autoScroll={false}
        onDragStart={(event) => setDraggedId(String(event.active.id))}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={cancelDrag}
      >
        <div className={styles.list}>
          {attachments.map((attachment) => (
            <AttachmentDraftCard
              key={attachment.id}
              attachment={attachment}
              disabled={disabled}
              isDragging={draggedId === attachment.id}
              dropPlacement={
                dropIndicator?.attachmentId === attachment.id
                  ? dropIndicator.placement
                  : null
              }
              onToggleSpoiler={() =>
                updateAttachment(attachment.id, {
                  isSpoiler: !attachment.isSpoiler
                })
              }
              onEdit={() => setEditingId(attachment.id)}
              onRemove={() =>
                onChange(
                  attachments.filter((item) => item.id !== attachment.id)
                )
              }
            />
          ))}
        </div>
      </DndContext>

      {editingAttachment && (
        <div className={styles.editorBackdrop} role="presentation">
          <section className={styles.editor} role="dialog" aria-modal="true">
            <header>
              <div>
                <span>{serverCopy.messages.attachment}</span>
                <h3>{serverCopy.messages.editAttachment}</h3>
              </div>
              <SystemIconButton
                icon="close"
                label={commonCopy.actions.close}
                onClick={() => setEditingId(null)}
              />
            </header>
            <label>
              <span>{serverCopy.messages.attachmentName}</span>
              <input
                value={editingAttachment.displayName}
                maxLength={255}
                onChange={(event) =>
                  updateAttachment(editingAttachment.id, {
                    displayName: event.target.value
                  })
                }
              />
            </label>
            <button
              className={styles.spoilerToggle}
              type="button"
              onClick={() =>
                updateAttachment(editingAttachment.id, {
                  isSpoiler: !editingAttachment.isSpoiler
                })
              }
            >
              <SystemIcon
                name={editingAttachment.isSpoiler ? 'eye-off' : 'eye'}
              />
              <span>
                <strong>{serverCopy.messages.hideAsSpoiler}</strong>
                <small>{serverCopy.messages.hideAsSpoilerDescription}</small>
              </span>
            </button>
          </section>
        </div>
      )}
    </>
  );
}

function AttachmentDraftCard({
  attachment,
  disabled,
  isDragging,
  dropPlacement,
  onToggleSpoiler,
  onEdit,
  onRemove
}: {
  attachment: MessageAttachmentDraft;
  disabled: boolean;
  isDragging: boolean;
  dropPlacement: AttachmentDropPlacement | null;
  onToggleSpoiler: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState('');
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform
  } = useDraggable({ id: attachment.id, disabled });
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: attachment.id,
    disabled
  });
  const isImage = attachment.file.type.startsWith('image/');
  const isVideo = attachment.file.type.startsWith('video/');
  const dragStyle = transform
    ? ({
        transform: `translate3d(${transform.x}px, 0, 0)`,
        transition: 'none',
        willChange: 'transform'
      } satisfies CSSProperties)
    : undefined;

  useEffect(() => {
    if (!isImage && !isVideo) return undefined;
    const url = URL.createObjectURL(attachment.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment.file, isImage, isVideo]);

  return (
    <div
      ref={setDroppableRef}
      className={`${styles.dropSlot} ${
        dropPlacement === 'before' ? styles.dropBefore : ''
      } ${dropPlacement === 'after' ? styles.dropAfter : ''}`}
    >
      <article
        ref={setDraggableRef}
        className={`${styles.card} ${attachment.isSpoiler ? styles.spoiler : ''} ${
          isDragging ? styles.dragging : ''
        }`}
        style={dragStyle}
        {...listeners}
        {...attributes}
      >
        <div className={styles.preview}>
          {isImage && previewUrl ? (
            <img src={previewUrl} alt="" />
          ) : isVideo && previewUrl ? (
            <video src={previewUrl} muted preload="metadata" />
          ) : (
            <SystemIcon
              name={getDraftFileIcon(attachment.file)}
              size={42}
              glow
            />
          )}
        </div>
        <div className={styles.actions}>
          <SystemIconButton
            icon={attachment.isSpoiler ? 'eye-off' : 'eye'}
            label={serverCopy.messages.hideAsSpoiler}
            disabled={disabled}
            onClick={onToggleSpoiler}
          />
          <SystemIconButton
            icon="edit"
            label={commonCopy.actions.edit}
            disabled={disabled}
            onClick={onEdit}
          />
          <SystemIconButton
            icon="trash"
            label={serverCopy.messages.removeFile(attachment.displayName)}
            disabled={disabled}
            onClick={onRemove}
          />
        </div>
        <footer>
          <strong>{attachment.displayName}</strong>
          <small>{formatFileSize(attachment.file.size)}</small>
        </footer>
      </article>
    </div>
  );
}

type AttachmentDropPlacement = 'before' | 'after';

type AttachmentDropIndicator = {
  attachmentId: string;
  placement: AttachmentDropPlacement;
};

function getAttachmentDropIndicator(
  attachments: MessageAttachmentDraft[],
  activeId: string,
  overId: string | null
): AttachmentDropIndicator | null {
  if (!overId || activeId === overId) return null;
  const activeIndex = attachments.findIndex((item) => item.id === activeId);
  const overIndex = attachments.findIndex((item) => item.id === overId);
  if (activeIndex < 0 || overIndex < 0) return null;
  return {
    attachmentId: overId,
    placement: activeIndex < overIndex ? 'after' : 'before'
  };
}

const attachmentCollisionDetection: CollisionDetection = (args) =>
  closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => container.id !== args.active.id
    )
  });

function getDraftFileIcon(file: File): 'archive' | 'video' | 'file' {
  if (file.type.startsWith('video/')) return 'video';
  if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(file.name)) return 'archive';
  return 'file';
}
