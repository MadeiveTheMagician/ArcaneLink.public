export type ModerationReasonCode =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'scam'
  | 'privacy'
  | 'other'

export type ModerationCaseStatus =
  | 'open'
  | 'in_review'
  | 'resolved'
  | 'dismissed'

export type CreateModerationReportRequest = {
  reasonCode: ModerationReasonCode
  details: string | null
}

export type ModerationReportResponse = {
  reportId: string
  serverId: string
  spaceId: string
  messageId: string
  reasonCode: ModerationReasonCode
  details: string | null
  status: string
  submittedAt: string
  updatedAt: string
}

export type ModerationCaseCursorResponse = {
  updatedAt: string
  id: string
}

export type ModerationCasePageResponse = {
  items: ModerationCaseSummaryResponse[]
  nextCursor: ModerationCaseCursorResponse | null
}

export type ModerationCaseSummaryResponse = {
  caseId: string
  serverId: string
  spaceId: string
  messageId: string
  reportedUserId: string
  reportedUserDisplayName: string
  status: ModerationCaseStatus
  submissionCount: number
  reasonCodes: ModerationReasonCode[]
  createdAt: string
  updatedAt: string
}

export type ModerationCaseDetailResponse = {
  caseId: string
  serverId: string
  spaceId: string
  messageId: string
  reportedUserId: string
  reportedUserDisplayName: string
  status: ModerationCaseStatus
  createdAt: string
  updatedAt: string
  evidence: ModerationEvidenceResponse[]
  actions: ModerationCaseActionResponse[]
}

export type ModerationEvidenceResponse = {
  evidenceId: string
  reasonCode: ModerationReasonCode
  details: string | null
  submittedAt: string
  bodyExcerpt: string | null
  payloadExcerpt: string | null
  contentSha256: string
  messageCreatedAt: string
  messageUpdatedAt: string
  messageEditedAt: string | null
  capturedAt: string
  assets: ModerationEvidenceAssetResponse[]
}

export type ModerationEvidenceAssetResponse = {
  evidenceAssetId: string
  displayOrder: number
  fileName: string
  mimeType: string
  sizeBytes: number
  sha256: string
  width: number | null
  height: number | null
  isSpoiler: boolean
  createdAt: string
  contentUrl: string
}

export type ModerationCaseActionResponse = {
  actionId: string
  fromStatus: ModerationCaseStatus
  toStatus: ModerationCaseStatus
  note: string | null
  createdAt: string
}

export type UpdateModerationCaseRequest = {
  status: ModerationCaseStatus
  note: string | null
  expectedUpdatedAt: string
}
