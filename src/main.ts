import * as core from '@actions/core'
import * as github from '@actions/github'
import { graphql } from '@octokit/graphql'
import { Repository } from '@octokit/graphql-schema'
import { getInputs, Inputs } from './context'

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
		core.info(
			`externalContributorLabel: ${inputs.externalContributorLabel}`
		)
		core.info(`pullRequestAssigneIssue: ${inputs.pullRequestAssigneIssue}`)
		core.info(`warnMissingIssue: ${inputs.warnMissingIssue}`)
		core.info(`missingIssueMessage: ${inputs.missingIssueMessage}`)
		core.endGroup()

		const issueType =
			context.eventName === 'issues' ? 'issue' : 'pull request'
		const issue =
			issueType === 'issue'
				? context.payload.issue
				: context.payload.pull_request

		if (!issue) {
			throw new Error(
				'No issue or pull request found in the payload, this action only supports issues and pull requests.'
			)
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
		const issueNumber = issue.number
		const assignees = issue.assignees

		core.startGroup(`Issue info`)
		core.info(`issueType: ${issueType}`)
		core.info(`issueNumber: ${issueNumber}`)
		core.info(`communityContributor: ${communityContributor}`)
		core.info(`assignees: ${assignees}`)
		core.info(`firstTimeContributor: ${firstTimeContributor}`)
		core.info(`labels: ${issue.labels}`)
		core.endGroup()

		if (!communityContributor) {
			core.info(`Not a community contributor, exiting...`)
			return
		}

		const shouldReply =
			issueType === 'issue'
				? inputs.replyToIssue
				: inputs.replyToPullRequest

		if (shouldReply) {
			const COMMENT_MARKER = '<!-- nginx-bot-comment -->'
			let message = `Hi @${issue.user.login}!`

			if (firstTimeContributor) {
				message = `${message} Welcome to the project! 🎉`
			}
			const issueMessage =
				issueType === 'issue'
					? inputs.messageIssue
					: inputs.messagePullRequest

			message = `${message}\n\n${issueMessage}`

			if (issueType === 'pull request' && inputs.warnMissingIssue) {
				const { repository } = await graphql<{
					repository: Repository
				}>({
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
					`linked issues numbers: ${repository.pullRequest?.closingIssuesReferences?.edges?.map(issueFound => issueFound?.node?.number)}`
				)

				const hasLinkedIssues =
					(repository.pullRequest?.closingIssuesReferences?.edges
						?.length ?? 0) > 0

				if (!hasLinkedIssues) {
					message = `${message}\n\n${inputs.missingIssueMessage}`
				}
			}

			message = `${message}\n\n${COMMENT_MARKER}`
			core.info(`message: ${message}`)

			const { data: comments } = await client.rest.issues.listComments({
				...context.repo,
				issue_number: issue.number
			})

			const existingComment = comments.find(comment =>
				comment.body?.includes(COMMENT_MARKER)
			)

			if (existingComment) {
				await client.rest.issues.updateComment({
					...context.repo,
					comment_id: existingComment.id,
					body: message
				})
			} else {
				await client.rest.issues.createComment({
					...context.repo,
					issue_number: issue.number,
					body: message
				})
			}
		}

		let { data: labels } = await client.rest.issues.addLabels({
			...context.repo,
			issue_number: issue.number,
			labels: [inputs.externalContributorLabel]
		})

		if (
			inputs.pullRequestAssigneIssue !== '' &&
			issueType === 'pull request' &&
			issue.assignees.length === 0
		) {
			const communityIssueNumber = parseInt(
				inputs.pullRequestAssigneIssue
			)

			const { data: communityIssue } = await client.rest.issues.get({
				...context.repo,
				issue_number: communityIssueNumber
			})
			const issueAssignees =
				communityIssue.assignees?.map(assignee => assignee.login) ?? []

			await client.rest.issues.addAssignees({
				...context.repo,
				issue_number: issue.number,
				assignees: [...issueAssignees]
			})
			core.info(`Assignees added to the pull request: ${assignees}`)
		}

		const match = issue.body?.match(/```release-notes([\s\S]*?)```/)
		let shouldAddLabel = false

		if (match) {
			const note = match[1].trim()
			core.info(`release-notes: ${note}`)
			shouldAddLabel = note.toUpperCase() !== 'NONE' && note !== ''
		}

		if (shouldAddLabel) {
			;({ data: labels } = await client.rest.issues.addLabels({
				...context.repo,
				issue_number: issue.number,
				labels: [inputs.releaseNotesLabel]
			}))
			core.debug(`Labels added: ${inputs.releaseNotesLabel}`)
		} else {
			try {
				;({ data: labels } = await client.rest.issues.removeLabel({
					...context.repo,
					issue_number: issue.number,
					name: inputs.releaseNotesLabel
				}))
				core.debug(`Label removed: ${inputs.releaseNotesLabel}`)
			} catch (error) {
				core.debug(`Label not found: ${inputs.releaseNotesLabel}`)
			}
		}
		core.info(`Labels: ${labels.map(label => label.name)}`)
		// Set outputs for other workflow steps to use
	} catch (error) {
		// Fail the workflow run if an error occurs
		if (error instanceof Error) core.setFailed(error.message)
	}
}
