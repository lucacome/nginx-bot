import * as core from '@actions/core'

import * as github from '@actions/github'
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
    core.info(`inputs: ${inputs}`)
    const client = github.getOctokit(inputs.githubToken)

    // if it's an issue, get all the info about the issue
    if (context.eventName === 'issues') {
      const issue = context.payload.issue
      if (issue) {
        console.log(
          `Issue ${issue.number} was ${issue.action} by ${issue.user.login}`
        )
        console.log(`author_association: ${issue.author_association}`)
        console.log(`milestone: ${issue.milestone}`)

        // print all the labels
        console.log(`labels: ${issue.labels.map((label: any) => label.name)}`)
        console.log(
          `assignees: ${issue.assignees.map((assignee: any) => assignee.login)}`
        )
        const { data: issueData } = await client.rest.issues.get({
          ...context.repo,
          issue_number: issue.number
        })
        console.log(`Issue data: ${issueData.url}`)
        console.log(`Issue body: ${issueData.body}`)
      }
    }
    // if it's a pull request, get all the info about the pull request
    if (context.eventName === 'pull_request') {
      const pullRequest = context.payload.pull_request
      if (pullRequest) {
        console.log(
          `Pull request ${pullRequest.number} was ${pullRequest.action} by ${pullRequest.user.login}`
        )
        console.log(`author_association: ${pullRequest.author_association}`)
        console.log(`milestone: ${pullRequest.milestone}`)
        console.log(
          `labels: ${pullRequest.labels.map((label: any) => label.name)}`
        )
        console.log(
          `assignees: ${pullRequest.assignees.map((assignee: any) => assignee.login)}`
        )
        const { data: pullRequestData } = await client.rest.pulls.get({
          ...context.repo,
          pull_number: pullRequest.number
        })
        console.log(`Pull request data: ${pullRequestData.url}`)
        console.log(`Pull request body: ${pullRequestData.body}`)

        // if the author of the pull request is not a member of the organization or a collaborator, add a label
        if (
          pullRequest.author_association !== 'MEMBER' &&
          pullRequest.author_association !== 'COLLABORATOR'
        ) {
          await client.rest.issues.addLabels({
            ...context.repo,
            issue_number: pullRequest.number,
            labels: ['external']
          })
        }
        // if the author is a first time contributor, send a welcome message
        if (pullRequest.author_association !== 'FIRST_TIME_CONTRIBUTOR') {
          await client.rest.issues.createComment({
            ...context.repo,
            issue_number: pullRequest.number,
            body: `Welcome to the project, @${pullRequest.user.login}!`
          })
        }
      }
    }

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
