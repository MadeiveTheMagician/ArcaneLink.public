import type {
  FriendRequestResponse,
  FriendUserResponse,
  ServerMemberResponse,
  UserFriendResponse
} from '../../../../shared/types';
import type { VoiceChannelController } from '../../../Server/hooks/voice/useVoiceChannel';
import { SystemTabPanel, SystemTabs, communityCopy } from '../../../shared';
import { BlacklistCommunityTab } from './BlacklistCommunityTab';
import { FriendsCommunityTab } from './FriendsCommunityTab';
import { PeopleCommunityTab } from './PeopleCommunityTab';
import { toggleStringInList } from './communityFilters';
import type { CommunityTab } from './communityTypes';
import { useCommunityDiscovery } from './useCommunityDiscovery';

import shellStyles from './CommunityShell.module.css';

const communityTabs: Array<{ label: string; value: CommunityTab }> = [
  { label: communityCopy.tabs.friends, value: 'friends' },
  { label: communityCopy.tabs.people, value: 'people' },
  { label: communityCopy.tabs.blocklist, value: 'blocklist' }
];

export type CommunityViewProps = {
  accessToken: string;
  activeTab: CommunityTab;
  friendNotice: string | null;
  friendSearchQuery: string;
  friendUserIds: Set<string>;
  friends: UserFriendResponse[];
  incomingFriendRequests: FriendRequestResponse[];
  isLoadingFriends: boolean;
  isMutatingFriends: boolean;
  isSearchingUsers: boolean;
  outgoingFriendRequests: FriendRequestResponse[];
  pendingOutgoingUserIds: Set<string>;
  visibleServerMemberships: ServerMemberResponse[];
  voice: VoiceChannelController;
  onAcceptFriendRequest: (requestId: string) => void;
  onCancelFriendRequest: (requestId: string) => void;
  onDeclineFriendRequest: (requestId: string) => void;
  onFriendSearchQueryChange: (query: string) => void;
  onOpenDirectSpace: (userId: string) => void;
  onStartDirectVoice: (user: FriendUserResponse) => void;
  onRemoveFriend: (userId: string) => void;
  onSendFriendRequest: (userId: string) => void;
  onTabChange: (tab: CommunityTab) => void;
};

export function CommunityView({
  accessToken,
  activeTab,
  friendNotice,
  friendSearchQuery,
  friendUserIds,
  friends,
  incomingFriendRequests,
  isLoadingFriends,
  isMutatingFriends,
  isSearchingUsers,
  outgoingFriendRequests,
  pendingOutgoingUserIds,
  visibleServerMemberships,
  voice,
  onAcceptFriendRequest,
  onCancelFriendRequest,
  onDeclineFriendRequest,
  onFriendSearchQueryChange,
  onOpenDirectSpace,
  onStartDirectVoice,
  onRemoveFriend,
  onSendFriendRequest,
  onTabChange
}: CommunityViewProps) {
  const {
    discoveredPeople,
    isDiscoveringPeople,
    peopleOnlineOnly,
    peopleScope,
    peopleSort,
    profileTags,
    selectedTagIds,
    setPeopleOnlineOnly,
    setPeopleScope,
    setPeopleSort,
    setSelectedTagIds
  } = useCommunityDiscovery({
    accessToken,
    activeTab,
    peopleSearchQuery: friendSearchQuery
  });
  return (
    <div className={shellStyles.communityContainer}>
      <section className={shellStyles.communitySurface}>
        <header className={shellStyles.communityHeader}>
          <div>
            <h1>{communityCopy.title}</h1>
          </div>
        </header>

        <SystemTabs
          idBase="community"
          label={communityCopy.labels.sections}
          onChange={onTabChange}
          options={communityTabs}
          value={activeTab}
        />

        <SystemTabPanel
          className={[
            shellStyles.communityTabPanel,
            friendNotice ? shellStyles.communityTabPanelWithNotice : ''
          ].join(' ')}
          idBase="community"
          value={activeTab}
        >
          {friendNotice && (
            <p className={shellStyles.communityNotice}>{friendNotice}</p>
          )}

          {activeTab === 'friends' && (
            <FriendsCommunityTab
              friendSearchQuery={friendSearchQuery}
              friends={friends}
              incomingFriendRequests={incomingFriendRequests}
              isLoadingFriends={isLoadingFriends}
              isMutatingFriends={isMutatingFriends}
              outgoingFriendRequests={outgoingFriendRequests}
              profileTags={profileTags}
              selectedTagIds={selectedTagIds}
              visibleServerMemberships={visibleServerMemberships}
              voice={voice}
              onAcceptFriendRequest={onAcceptFriendRequest}
              onCancelFriendRequest={onCancelFriendRequest}
              onDeclineFriendRequest={onDeclineFriendRequest}
              onFriendSearchQueryChange={onFriendSearchQueryChange}
              onOpenDirectSpace={onOpenDirectSpace}
              onRemoveFriend={onRemoveFriend}
              onStartDirectVoice={onStartDirectVoice}
              onToggleTag={(tagId) =>
                setSelectedTagIds((current) =>
                  toggleStringInList(current, tagId)
                )
              }
            />
          )}

          {activeTab === 'people' && (
            <PeopleCommunityTab
              discoveredPeople={discoveredPeople}
              friendSearchQuery={friendSearchQuery}
              friendUserIds={friendUserIds}
              incomingFriendRequests={incomingFriendRequests}
              isDiscoveringPeople={isDiscoveringPeople}
              isMutatingFriends={isMutatingFriends}
              isSearchingUsers={isSearchingUsers}
              outgoingFriendRequests={outgoingFriendRequests}
              pendingOutgoingUserIds={pendingOutgoingUserIds}
              peopleOnlineOnly={peopleOnlineOnly}
              peopleScope={peopleScope}
              peopleSort={peopleSort}
              profileTags={profileTags}
              selectedTagIds={selectedTagIds}
              onAcceptFriendRequest={onAcceptFriendRequest}
              onFriendSearchQueryChange={onFriendSearchQueryChange}
              onPeopleOnlineToggle={() =>
                setPeopleOnlineOnly((isOnlineOnly) => !isOnlineOnly)
              }
              onPeopleScopeChange={setPeopleScope}
              onPeopleSortChange={setPeopleSort}
              onSendFriendRequest={onSendFriendRequest}
              onToggleTag={(tagId) =>
                setSelectedTagIds((current) =>
                  toggleStringInList(current, tagId)
                )
              }
            />
          )}

          {activeTab === 'blocklist' && (
            <BlacklistCommunityTab accessToken={accessToken} />
          )}
        </SystemTabPanel>
      </section>
    </div>
  );
}
