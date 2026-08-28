import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type Modifier,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors
} from '@dnd-kit/core';

import {
  type DragPoint,
  type FolderDropPlacement,
  privateSpaceDragPreviewSize,
  resolveCenteredDragPreviewTransform,
  resolveFolderChipDropPlacement,
  resolvePointerDropPlacement
} from './privateSpaceFolderDragModel';

export type { FolderDropPlacement } from './privateSpaceFolderDragModel';

export type PrivateSpaceFolderDragState = {
  expandedFolderId: string | null;
  activeFolderId: string | null;
  overFolderId: string | null;
  placement: FolderDropPlacement | null;
  activeSpaceId: string | null;
  overSpaceId: string | null;
  spacePlacement: FolderDropPlacement | null;
};

type Props = {
  disabled?: boolean;
  folderDragAxis?: 'free' | 'horizontal';
  onAssign: (folderId: string, spaceId: string) => Promise<void>;
  onReorderFolders: (
    activeFolderId: string,
    overFolderId: string,
    placement: FolderDropPlacement
  ) => Promise<void>;
  onReorderSpaces: (
    activeSpaceId: string,
    overSpaceId: string,
    placement: FolderDropPlacement
  ) => Promise<void>;
  children: (state: PrivateSpaceFolderDragState) => ReactNode;
};

const restrictFolderDragToHorizontal: Modifier = ({ active, transform }) =>
  active?.data.current?.dragType === 'private-folder'
    ? { ...transform, y: 0 }
    : transform;

const horizontalDragModifiers = [restrictFolderDragToHorizontal];

function getPointerActivationPoint(event: Event): DragPoint | null {
  if ('clientX' in event && 'clientY' in event) {
    const { clientX, clientY } = event as MouseEvent | PointerEvent;
    return Number.isFinite(clientX) && Number.isFinite(clientY)
      ? { x: clientX, y: clientY }
      : null;
  }

  if ('touches' in event) {
    const touch = (event as TouchEvent).touches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  return null;
}

const centerPrivateSpaceOverlayOnPointer: Modifier = ({
  active,
  activeNodeRect,
  activatorEvent,
  transform
}) => {
  if (
    active?.data.current?.dragType !== 'private-space' ||
    !activeNodeRect ||
    !activatorEvent
  ) {
    return transform;
  }

  const activationPoint = getPointerActivationPoint(activatorEvent);
  if (!activationPoint) {
    return transform;
  }

  const centeredTransform = resolveCenteredDragPreviewTransform({
    transform,
    activationPoint,
    sourceRect: activeNodeRect,
    previewSize: privateSpaceDragPreviewSize
  });

  return {
    ...transform,
    ...centeredTransform
  };
};

const privateSpaceOverlayModifiers = [centerPrivateSpaceOverlayOnPointer];
const horizontalOverlayModifiers = [
  restrictFolderDragToHorizontal,
  centerPrivateSpaceOverlayOnPointer
];

type ActiveOverlay = {
  content: ReactNode;
  style?: CSSProperties;
};

function clampDragEntryScale(value: number, maximum: number) {
  return Math.min(maximum, Math.max(1, value));
}

export function PrivateSpaceFolderDragArea({
  disabled = false,
  folderDragAxis = 'free',
  onAssign,
  onReorderFolders,
  onReorderSpaces,
  children
}: Props) {
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay | null>(
    null
  );
  const [folderDragState, setFolderDragState] = useState<
    Omit<PrivateSpaceFolderDragState, 'expandedFolderId'>
  >({
    activeFolderId: null,
    overFolderId: null,
    placement: null,
    activeSpaceId: null,
    overSpaceId: null,
    spacePlacement: null
  });
  const activeDragTypeRef = useRef<string | null>(null);
  const pointerPositionRef = useRef<DragPoint | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } })
  );

  useEffect(() => {
    function trackPointer(event: PointerEvent) {
      if (!activeDragTypeRef.current) return;
      pointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY
      };
    }

    window.addEventListener('pointermove', trackPointer, true);
    return () => window.removeEventListener('pointermove', trackPointer, true);
  }, []);

  function readFolderId(event: DragMoveEvent | DragOverEvent | DragEndEvent) {
    if (event.over?.data.current?.isSystem) return undefined;
    return event.over?.data.current?.folderId as string | undefined;
  }

  function readSpaceId(event: DragMoveEvent | DragOverEvent | DragEndEvent) {
    return event.over?.data.current?.spaceId as string | undefined;
  }

  function resetDragState() {
    setExpandedFolderId(null);
    setActiveOverlay(null);
    setFolderDragState({
      activeFolderId: null,
      overFolderId: null,
      placement: null,
      activeSpaceId: null,
      overSpaceId: null,
      spacePlacement: null
    });
    activeDragTypeRef.current = null;
    pointerPositionRef.current = null;
  }

  function updateDragTarget(event: DragMoveEvent | DragOverEvent) {
    const dragType = event.active.data.current?.dragType;
    activeDragTypeRef.current = typeof dragType === 'string' ? dragType : null;
    const folderId = readFolderId(event) ?? null;
    const spaceId = readSpaceId(event) ?? null;
    setExpandedFolderId(dragType === 'private-space' ? folderId : null);
    const pointer = pointerPositionRef.current;
    const overRect = event.over?.rect;

    if (dragType === 'private-space' && spaceId && pointer && overRect) {
      const placement = resolvePointerDropPlacement({
        pointer,
        targetRect: overRect,
        axis: 'vertical'
      });
      setFolderDragState((current) => ({
        activeFolderId: null,
        overFolderId: null,
        placement: null,
        activeSpaceId: current.activeSpaceId,
        overSpaceId: spaceId,
        spacePlacement: placement
      }));
      return;
    }

    if (dragType !== 'private-folder' || !folderId || !pointer || !overRect) {
      setFolderDragState((current) => ({
        activeFolderId:
          dragType === 'private-folder' ? current.activeFolderId : null,
        overFolderId: null,
        placement: null,
        activeSpaceId:
          dragType === 'private-space' ? current.activeSpaceId : null,
        overSpaceId: null,
        spacePlacement: null
      }));
      return;
    }

    const activeRect =
      event.active.rect.current.translated ?? event.active.rect.current.initial;
    const placement = resolveFolderChipDropPlacement({
      pointer,
      targetRect: overRect,
      activeRect
    });

    setFolderDragState((current) => ({
      activeFolderId: current.activeFolderId,
      overFolderId: folderId,
      placement,
      activeSpaceId: null,
      overSpaceId: null,
      spacePlacement: null
    }));
  }

  function handleDragStart(event: DragStartEvent) {
    const dragType = event.active.data.current?.dragType;
    activeDragTypeRef.current = typeof dragType === 'string' ? dragType : null;
    const sourceRect = event.active.rect.current.initial;
    const privateSpaceOverlayStyle =
      dragType === 'private-space'
        ? ({
            width: privateSpaceDragPreviewSize.width,
            height: privateSpaceDragPreviewSize.height,
            '--private-space-drag-entry-scale-x': String(
              clampDragEntryScale(
                (sourceRect?.width ?? privateSpaceDragPreviewSize.width) /
                  privateSpaceDragPreviewSize.width,
                2.6
              )
            ),
            '--private-space-drag-entry-scale-y': String(
              clampDragEntryScale(
                (sourceRect?.height ?? privateSpaceDragPreviewSize.height) /
                  privateSpaceDragPreviewSize.height,
                1.8
              )
            )
          } as CSSProperties)
        : undefined;
    setActiveOverlay({
      content: (event.active.data.current?.overlay as ReactNode) ?? null,
      style: privateSpaceOverlayStyle
    });
    setFolderDragState({
      activeFolderId:
        dragType === 'private-folder'
          ? (event.active.data.current?.folderId as string)
          : null,
      overFolderId: null,
      placement: null,
      activeSpaceId:
        dragType === 'private-space'
          ? (event.active.data.current?.spaceId as string)
          : null,
      overSpaceId: null,
      spacePlacement: null
    });

    pointerPositionRef.current = getPointerActivationPoint(
      event.activatorEvent
    );
  }

  function handleDragMove(event: DragMoveEvent) {
    updateDragTarget(event);
  }

  function handleDragOver(event: DragOverEvent) {
    updateDragTarget(event);
  }

  function handleDragEnd(event: DragEndEvent) {
    const folderId = readFolderId(event);
    const overSpaceId = readSpaceId(event);
    const spaceId = event.active.data.current?.spaceId as string | undefined;
    const draggedFolderId = event.active.data.current?.folderId as
      string | undefined;
    const pointer = pointerPositionRef.current;
    const activeRect =
      event.active.rect.current.translated ?? event.active.rect.current.initial;
    const placement =
      folderId && pointer && event.over?.rect
        ? resolveFolderChipDropPlacement({
            pointer,
            targetRect: event.over.rect,
            activeRect
          })
        : (folderDragState.placement ?? 'before');
    const spacePlacement =
      overSpaceId && pointer && event.over?.rect
        ? resolvePointerDropPlacement({
            pointer,
            targetRect: event.over.rect,
            axis: 'vertical'
          })
        : (folderDragState.spacePlacement ?? 'before');
    resetDragState();

    if (overSpaceId && spaceId && overSpaceId !== spaceId) {
      void onReorderSpaces(spaceId, overSpaceId, spacePlacement);
    } else if (folderId && spaceId) {
      void onAssign(folderId, spaceId);
    } else if (folderId && draggedFolderId) {
      void onReorderFolders(draggedFolderId, folderId, placement);
    }
  }

  const dragModifiers =
    folderDragAxis === 'horizontal' ? horizontalDragModifiers : undefined;
  const overlayModifiers =
    folderDragAxis === 'horizontal'
      ? horizontalOverlayModifiers
      : privateSpaceOverlayModifiers;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      autoScroll={false}
      modifiers={dragModifiers}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragCancel={resetDragState}
      onDragEnd={handleDragEnd}
    >
      {children({
        expandedFolderId: disabled ? null : expandedFolderId,
        activeFolderId: disabled ? null : folderDragState.activeFolderId,
        overFolderId: disabled ? null : folderDragState.overFolderId,
        placement: disabled ? null : folderDragState.placement,
        activeSpaceId: disabled ? null : folderDragState.activeSpaceId,
        overSpaceId: disabled ? null : folderDragState.overSpaceId,
        spacePlacement: disabled ? null : folderDragState.spacePlacement
      })}
      <DragOverlay
        adjustScale={false}
        dropAnimation={null}
        modifiers={overlayModifiers}
        style={activeOverlay?.style}
        zIndex={220}
      >
        {activeOverlay?.content}
      </DragOverlay>
    </DndContext>
  );
}
