export const userBlockChangedEventName = 'arcanelink:user-block-changed';

export type UserBlockChangedDetail = {
  userId: string;
  isBlocked: boolean;
  comment: string | null;
};

export function dispatchUserBlockChanged(detail: UserBlockChangedDetail) {
  window.dispatchEvent(
    new CustomEvent<UserBlockChangedDetail>(userBlockChangedEventName, {
      detail
    })
  );
}

export function isUserBlockChangedEvent(
  event: Event
): event is CustomEvent<UserBlockChangedDetail> {
  return (
    event instanceof CustomEvent &&
    typeof event.detail?.userId === 'string' &&
    typeof event.detail?.isBlocked === 'boolean'
  );
}
