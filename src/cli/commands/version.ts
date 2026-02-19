/**
 * VoxKit CLI - Version Command
 */

import chalk from 'chalk'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

export function versionCommand(): void {
  try {
    // Try to read package.json
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const packagePath = resolve(__dirname, '..', '..', '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
    
    console.log(chalk.blue(`\n🎙️  VoxKit v${packageJson.version}\n`))
    console.log(chalk.white(packageJson.description))
    console.log(chalk.gray(`\nRepository: ${packageJson.repository.url}`))
    console.log(chalk.gray(`License: ${packageJson.license}\n`))
  } catch {
    console.log(chalk.blue('\n🎙️  VoxKit v1.0.0\n'))
    console.log(chalk.white('Open Source Voice Agent Framework\n'))
  }
}
