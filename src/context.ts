import * as core from '@actions/core'

export interface Inputs {
  githubToken: string
}

export function getInputs(): Inputs {
  return {
    githubToken: core.getInput('github-token')
  }
}
