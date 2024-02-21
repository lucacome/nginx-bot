import * as core from '@actions/core'

export interface Inputs {
  githubToken: string
  replyToIssue: boolean
  replyToPullRequest: boolean
  messageIssue: string
  messagePullRequest: string
  externalContributorLabel: string
  pullRequestAssigneIssue: string
  warnMissingIssue: boolean
  missingIssueMessage: string
}

export function getInputs(): Inputs {
  return {
    githubToken: core.getInput('github-token'),
    replyToIssue: core.getBooleanInput('reply-to-issues'),
    replyToPullRequest: core.getBooleanInput('reply-to-prs'),
    messageIssue: core.getInput('message-issue'),
    messagePullRequest: core.getInput('message-pr'),
    externalContributorLabel: core.getInput('external-contributor-label'),
    pullRequestAssigneIssue: core.getInput('pr-assignee-from-issue'),
    warnMissingIssue: core.getBooleanInput('warn-missing-issue'),
    missingIssueMessage: core.getInput('missing-issue-message')
  }
}
