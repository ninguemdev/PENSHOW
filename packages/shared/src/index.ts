export { healthResponseSchema } from './schemas/health.js';
export {
  TIEBREAK_RULES,
  TIEBREAK_OBSTACLES,
  tiebreakContextSchema,
  tiebreakInputSchema,
  tiebreakFrameSchema,
  tiebreakViewSchema,
} from './schemas/tiebreak.js';
export type { TiebreakInput, TiebreakFrame, TiebreakView } from './schemas/tiebreak.js';
export type { HealthResponse } from './schemas/health.js';
export { CONFIRMED_FINAL_RULES, CONFIRMED_DECISIONS, PENDING_DECISIONS } from './domain/rules.js';
export { ROOM_LIMITS } from './domain/rooms.js';
export type { PendingDecisionId } from './domain/rules.js';
export {
  actionIdSchema,
  categoryIdSchema,
  matchIdSchema,
  optionIdSchema,
  playerIdSchema,
  questionIdSchema,
  roomCodeSchema,
  roomIdSchema,
  roundIdSchema,
  stateVersionSchema,
  timestampSchema,
} from './schemas/identifiers.js';
export type {
  ActionId,
  MatchId,
  OptionId,
  PlayerId,
  QuestionId,
  RoomId,
  RoundId,
} from './schemas/identifiers.js';
export {
  avatarSchema,
  connectionSchema,
  nicknameSchema,
  playerProfileSchema,
  roomMemberSchema,
} from './schemas/profile.js';
export type { Avatar, PlayerProfile, RoomMember } from './schemas/profile.js';
export {
  AVATAR_CATEGORIES,
  REQUIRED_AVATAR_CATEGORIES,
  OPTIONAL_AVATAR_CATEGORIES,
} from './domain/avatar.js';
export type {
  AvatarCategory,
  AvatarConfig,
  AvatarRandom,
  RequiredAvatarCategory,
  OptionalAvatarCategory,
} from './domain/avatar.js';
export {
  avatarCatalog,
  avatarCatalogSchema,
  avatarCategorySlug,
  activeOptions,
  findAvatarOption,
  isValidOptionId,
  isValidAvatar,
  defaultAvatar,
  randomAvatar,
  sanitizeAvatar,
} from './avatar/catalog.js';
export type { AvatarCatalog, AvatarOption } from './avatar/catalog.js';
export {
  EDITABLE_AVATAR_CATEGORIES,
  AVATAR_LAYOUT_LIMITS,
  DEFAULT_AVATAR_TRANSFORM,
  avatarTransformSchema,
  avatarLayoutSchema,
  sanitizeAvatarLayout,
  avatarTransform,
  avatarLayerRect,
} from './avatar/layout.js';
export type { EditableAvatarCategory, AvatarTransform, AvatarLayout } from './avatar/layout.js';
export {
  roomSettingsSchema,
  roundSchema,
  scoringRoundSchema,
  pressureVariantSchema,
} from './schemas/settings.js';
export type { RoomSettings, Round, ScoringRound, ScoringMode } from './schemas/settings.js';
export {
  difficultySchema,
  publicOptionSchema,
  publicQuestionSchema,
  questionStemSchema,
  revealedQuestionSchema,
} from './schemas/question.js';
export type {
  PublicOption,
  PublicQuestion,
  QuestionStem,
  RevealedQuestion,
} from './schemas/question.js';
export {
  finalistSchema,
  finalistsSchema,
  rankingSchema,
  scoreboardSchema,
  scoreEffectSchema,
  scoreEntrySchema,
} from './schemas/score.js';
export type { Finalist, Ranking, ScoreEffect, ScoreEntry, Scoreboard } from './schemas/score.js';
export { finalEntrySchema, qualificationPolicySchema } from './schemas/final-entry.js';
export type { FinalEntry, QualificationPolicy } from './schemas/final-entry.js';
export { roundSummarySchema } from './schemas/results.js';
export type { RoundSummary } from './schemas/results.js';
export {
  createDomainError,
  DOMAIN_ERROR_MESSAGES,
  domainErrorCodeSchema,
  domainErrorSchema,
} from './schemas/error.js';
export type { DomainError, DomainErrorCode } from './schemas/error.js';
export { clientCommandSchema } from './schemas/command.js';
export type { ClientCommand, ClientEvent, CommandOf } from './schemas/command.js';
export {
  finalResolutionSchema,
  matchStageSchema,
  matchViewSchema,
  ownAnswerSchema,
  ownWagerSchema,
  roomViewSchema,
} from './schemas/view.js';
export type { FinalResolution, MatchStage, MatchView, RoomView } from './schemas/view.js';
export {
  acknowledgementSchema,
  commandSuccessSchema,
  PROTOCOL_VERSION,
  serverEventSchema,
} from './schemas/protocol.js';
export type { Acknowledgement, CommandSuccess, ServerEvent } from './schemas/protocol.js';
export { roomRemovedSchema } from './schemas/room-removed.js';
export type { RoomRemoved } from './schemas/room-removed.js';
export {
  GUEST_SESSION_STORAGE_KEY,
  guestSessionTokenSchema,
  createGuestSessionRequestSchema,
  guestSessionParamsSchema,
  guestSessionSchema,
  issuedGuestSessionSchema,
  socketCredentialsSchema,
  sessionEndedSchema,
} from './schemas/session.js';
export type {
  GuestSessionToken,
  GuestSession,
  IssuedGuestSession,
  SocketCredentials,
} from './schemas/session.js';
