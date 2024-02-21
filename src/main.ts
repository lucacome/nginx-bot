import * as core from '@actions/core'

import * as github from '@actions/github'
import { getInputs, Inputs } from './context'
import { graphql } from '@octokit/graphql'
import { Repository } from '@octokit/graphql-schema'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const context = github.context
    core.startGroup(`Context info`)
    core.info(`eventName: ${context.eventName}`)
    core.info(`sha: ${context.sha}`)
    core.info(`ref: ${context.ref}`)
    core.info(`workflow: ${context.workflow}`)
    core.info(`action: ${context.action}`)
    core.info(`actor: ${context.actor}`)
    core.info(`runNumber: ${context.runNumber}`)
    core.info(`runId: ${context.runId}`)
    core.endGroup()

    const inputs: Inputs = getInputs()
    const client = github.getOctokit(inputs.githubToken)

    core.startGroup(`Settings info`)
    core.info(`replyToIssue: ${inputs.replyToIssue}`)
    core.info(`replyToPullRequest: ${inputs.replyToPullRequest}`)
    core.info(`messageIssue: ${inputs.messageIssue}`)
    core.info(`messagePullRequest: ${inputs.messagePullRequest}`)
    core.info(`externalContributorLabel: ${inputs.externalContributorLabel}`)
    core.info(`pullRequestAssigneIssue: ${inputs.pullRequestAssigneIssue}`)
    core.info(`warnMissingIssue: ${inputs.warnMissingIssue}`)
    core.info(`missingIssueMessage: ${inputs.missingIssueMessage}`)
    core.endGroup()

    const issueType = context.eventName === 'issues' ? 'issue' : 'pull request'
    const issue =
      issueType === 'issue'
        ? context.payload.issue
        : context.payload.pull_request

    if (!issue) {
      throw new Error('No issue or pull request found in the payload')
    }

    // member is a member of the organization that owns the repository
    // collaborator is an outside collaborator that has been invited to collaborate on the repository
    // none is probably a bot account
    const communityContributor =
      issue?.author_association !== 'MEMBER' &&
      issue?.author_association !== 'COLLABORATOR' &&
      issue?.author_association !== 'NONE'
    const firstTimeContributor =
      issue?.author_association === 'FIRST_TIME_CONTRIBUTOR'
    const issueNumber = issue?.number
    const assignees = issue?.assignees

    core.startGroup(`Issue info`)
    core.info(`issueType: ${issueType}`)
    core.info(`issueNumber: ${issueNumber}`)
    core.info(`communityContributor: ${communityContributor}`)
    core.info(`assignees: ${assignees}`)
    core.info(`firstTimeContributor: ${firstTimeContributor}`)
    core.endGroup()

    const shouldReply =
      issueType === 'issue' ? inputs.replyToIssue : inputs.replyToPullRequest

    if (shouldReply) {
      var message = `Hi @${issue.user.login}!`

      if (firstTimeContributor) {
        message = message + ` Welcome to the project! 🎉`
      }
      const issueMessage =
        issueType === 'issue' ? inputs.messageIssue : inputs.messagePullRequest
      message = message + `\n\n${issueMessage}`

      if (issueType === 'pull request' && inputs.warnMissingIssue) {
        // if it's a pull request, get linked issues from graphql
        // const { pullRequestData } = await graphql({
        const { repository } = await graphql<{ repository: Repository }>({
          query: `
			query ($owner: String!, $name: String!, $number: Int!) {
				repository(owner: $owner, name: $name) {
					pullRequest(number: $number) {
					id
					closingIssuesReferences(first: 5) {
						edges {
						  node {
							id
							body
							number
							title
						  }
						}
					}
					}
				}
			}`,
          headers: {
            authorization: `token ${inputs.githubToken}`
          },
          owner: context.repo.owner,
          name: context.repo.repo,
          number: issue.number
        })
        core.info(
          `linked issues numbers: ${repository.pullRequest?.closingIssuesReferences?.edges?.map((issue: any) => issue.node.number)}`
        )

        const hasLinkedIssues =
          (repository.pullRequest?.closingIssuesReferences?.edges?.length ??
            0) > 0

        // if the PR doesn't have a linked issue, send a message to the PR author
        if (!hasLinkedIssues) {
          message = message + `\n\n${inputs.missingIssueMessage}`
        }
      }

      core.info(`message: ${message}`)

      // add a comment to the issue
      await client.rest.issues.createComment({
        ...context.repo,
        issue_number: issue.number,
        body: message
      })
    }

    if (communityContributor) {
      await client.rest.issues.addLabels({
        ...context.repo,
        issue_number: issue.number,
        labels: [inputs.externalContributorLabel]
      })
    }
    // if it's a pull request, get all the info about the pull request
    // if (context.eventName === 'pull_request') {
    //   const pullRequest = context.payload.pull_request
    //   if (pullRequest) {
    //     console.log(
    //       `Pull request ${pullRequest.number} was ${pullRequest.action} by ${pullRequest.user.login}`
    //     )
    //     console.log(`author_association: ${pullRequest.author_association}`)
    //     console.log(`milestone: ${pullRequest.milestone}`)
    //     console.log(
    //       `labels: ${pullRequest.labels.map((label: any) => label.name)}`
    //     )
    //     console.log(
    //       `assignees: ${pullRequest.assignees.map((assignee: any) => assignee.login)}`
    //     )
    //     const { data: pullRequestData } = await client.rest.pulls.get({
    //       ...context.repo,
    //       pull_number: pullRequest.number
    //     })
    //     console.log(`Pull request data: ${pullRequestData.url}`)
    //     console.log(`Pull request body: ${pullRequestData.body}`)
    //
    //     // if the author of the pull request is not a member of the organization or a collaborator, add a label
    //     if (
    //       pullRequest.author_association !== 'MEMBER' &&
    //       pullRequest.author_association !== 'COLLABORATOR'
    //     ) {
    //       await client.rest.issues.addLabels({
    //         ...context.repo,
    //         issue_number: pullRequest.number,
    //         labels: ['external']
    //       })
    //     }
    //     // if the author is a first time contributor, send a welcome message if one doesn't already exist
    //     if (pullRequest.author_association !== 'FIRST_TIME_CONTRIBUTOR') {
    //       // TODO change this
    //       const { data: comments } = await client.rest.issues.listComments({
    //         ...context.repo,
    //         issue_number: pullRequest.number
    //       })
    //
    //       const existingComment = comments.find(comment =>
    //         comment.body?.includes('Welcome to the project')
    //       )
    //       if (!existingComment) {
    //         await client.rest.issues.createComment({
    //           ...context.repo,
    //           issue_number: pullRequest.number,
    //           body: `Welcome to the project, and thank you for your contribution @${pullRequest.user.login}! 🎉`
    //         })
    //       } else {
    //         await client.rest.issues.updateComment({
    //           ...context.repo,
    //           comment_id: existingComment.id,
    //           body: `Welcome to the project, and thank you for your contribution @${pullRequest.user.login}! 🎉`
    //         })
    //       }
    //     }
    //   }
    // }

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
