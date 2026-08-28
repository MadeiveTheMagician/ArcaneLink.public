import { useMobileScrollActionVisibility } from '../../../Mobile/hooks/useMobileScrollActionVisibility';

type MobileDirectMessageListOptions = {
  isLoading: boolean;
  isSearchActive: boolean;
  itemCount: number;
  viewKey: string;
};

export function useMobileDirectMessageList({
  isLoading,
  isSearchActive,
  itemCount,
  viewKey
}: MobileDirectMessageListOptions) {
  const { scrollRef, isActionVisible, handleScroll } =
    useMobileScrollActionVisibility({
      dependencyKey: `${viewKey}:${isLoading}:${isSearchActive}:${itemCount}`
    });

  return {
    listRef: scrollRef,
    isCreateVisible: isActionVisible,
    handleScroll
  };
}
