import {
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';

type ChatLike = Parameters<typeof lastAssistantMessageIsCompleteWithToolCalls>[0];
type ApprovalLike = Parameters<typeof lastAssistantMessageIsCompleteWithApprovalResponses>[0];

/**
 * Resume the conversation when the last assistant message is complete with
 * either tool outputs (client-side tools such as requestFormInput) or tool
 * approval responses (needsApproval tools). AI SDK v6 accepts one predicate,
 * so combine the two built-ins with OR.
 */
export const chatContinuationWhen = (chat: ChatLike & ApprovalLike): boolean =>
  lastAssistantMessageIsCompleteWithToolCalls(chat) ||
  lastAssistantMessageIsCompleteWithApprovalResponses(chat);
