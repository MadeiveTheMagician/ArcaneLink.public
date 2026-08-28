import { useEffect, useMemo, useState } from 'react';

import { apiJson } from '../../../shared/api/api';
import type { SpaceMessageResponse } from '../../../shared/types';
import { messageSearchHookCopy } from './messageSearch.copy';

export type MessageSearchFilters = {
  senderUserId: string;
  spaceId: string;
  attachmentType: string;
};

type SubmittedSearch = {
  endpoint: string | null;
  query: string;
  filters: MessageSearchFilters;
};

type UseMessageSearchOptions = {
  accessToken: string;
  endpoint: string | null;
  limit?: number;
};

const emptyFilters: MessageSearchFilters = {
  senderUserId: '',
  spaceId: '',
  attachmentType: ''
};

export function useMessageSearch({
  accessToken,
  endpoint,
  limit = 30
}: UseMessageSearchOptions) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<MessageSearchFilters>(emptyFilters);
  const [submittedSearch, setSubmittedSearch] =
    useState<SubmittedSearch | null>(null);
  const [results, setResults] = useState<SpaceMessageResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedQuery = query.trim();
  const submittedQuery = submittedSearch?.query ?? '';
  const hasSubmittedFilters = Boolean(
    submittedSearch?.filters.senderUserId ||
    submittedSearch?.filters.spaceId ||
    submittedSearch?.filters.attachmentType
  );
  const isActive =
    Boolean(submittedSearch) &&
    (submittedQuery.length > 0 || hasSubmittedFilters);
  const requestUrl = useMemo(() => {
    if (
      !endpoint ||
      !submittedSearch ||
      submittedSearch.endpoint !== endpoint
    ) {
      return null;
    }

    const params = new URLSearchParams({
      query: submittedSearch.query,
      limit: String(limit)
    });

    if (submittedSearch.filters.senderUserId) {
      params.set('senderUserId', submittedSearch.filters.senderUserId);
    }

    if (submittedSearch.filters.spaceId) {
      params.set('spaceId', submittedSearch.filters.spaceId);
    }

    if (submittedSearch.filters.attachmentType) {
      params.set('attachmentType', submittedSearch.filters.attachmentType);
    }

    return `${endpoint}?${params.toString()}`;
  }, [endpoint, limit, submittedSearch]);

  function submitSearch(filterOverride: MessageSearchFilters | null = null) {
    const nextFilters = filterOverride ?? filters;

    if (
      !normalizedQuery &&
      !nextFilters.senderUserId &&
      !nextFilters.spaceId &&
      !nextFilters.attachmentType
    ) {
      clearSearch();
      return;
    }

    setSubmittedSearch({
      endpoint,
      query: normalizedQuery,
      filters: nextFilters
    });
  }

  function clearSearch() {
    setQuery('');
    setFilters(emptyFilters);
    setSubmittedSearch(null);
    setResults([]);
    setError(null);
  }

  useEffect(() => {
    setQuery('');
    setFilters(emptyFilters);
    setSubmittedSearch(null);
    setResults([]);
    setError(null);
  }, [endpoint]);

  useEffect(() => {
    if (!requestUrl) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setError(null);

    void apiJson<SpaceMessageResponse[]>(requestUrl, {
      accessToken,
      signal: controller.signal
    })
      .then((items) => {
        setResults(items);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setError(messageSearchHookCopy.errors.searchFailed);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, requestUrl]);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    normalizedQuery,
    submittedQuery,
    results,
    isActive,
    isSearching,
    error,
    submitSearch,
    clearSearch
  };
}
