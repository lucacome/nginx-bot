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

        const { data: issueData } = await client.rest.issues.get({
          ...context.repo,
          issue_number: issue.number
        })
        console.log(`Issue data: ${JSON.stringify(issueData)}`)
      }
    }

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
