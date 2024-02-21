import * as core from '@actions/core'

export interface Inputs {
  githubToken: string
  replyToIssue: boolean
  replyToPullRequest: boolean
  messageIssue: string
  messagePullRequest: string
  externalContributorLabel: string
  pullRequestAssigneIssue: string
}

export function getInputs(): Inputs {
  return {
    githubToken: core.getInput('github-token'),
    replyToIssue: core.getInput('reply-to-issue') === 'true',
    replyToPullRequest: core.getInput('reply-to-pull-request') === 'true',
    messageIssue: core.getInput('message-issue'),
    messagePullRequest: core.getInput('message-pull-request'),
    externalContributorLabel: core.getInput('external-contributor-label'),
    pullRequestAssigneIssue: core.getInput('pull-request-assignee-issue')
  }
}
