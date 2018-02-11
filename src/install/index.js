'use strict'

const debug = require('debug')('windows-build-tools')
const chalk = require('chalk')

const { getPythonInstallerPath } = require('../utils/get-python-installer-path')
const { getWorkDirectory } = require('../utils/get-work-dir')
const { singleLineLog } = require('../utils/single-line-log')
const { log } = require('../logging')
const launchInstaller = require('./launch')
const Tailer = require('./tailer')

let vccLastLines = [ 'Still waiting for installer log file...' ]
let pythonLastLines = [ 'Still waiting for installer log file...' ]
let lastLinesInterval = null

/**
 * Installs the build tools, tailing the installation log file
 * to understand what's happening
 *
 * @returns {Promise.<Object>} - Promise that resolves with the installation result
 */

function install (cb) {
  log(chalk.green('Starting installation...'))

  launchInstaller()
    .then(() => launchLog())
    .then(() => Promise.all([installBuildTools(), installPython()]))
    .then((paths) => {
      stopLog()

      const variables = {
        buildTools: paths[0],
        python: paths[1]
      }
      cb(variables)
    })
    .catch((error) => {
      log(error)
    })
}

function launchLog () {
  log('Launched installers, now waiting for them to finish.')
  log('This will likely take some time - please be patient!\n')

  log('Status from the installers:')
  lastLinesInterval = setInterval(() => {
    const updatedLog = [ 'Visual Studio Build Tools:', ...vccLastLines, 'Python 2:', ...pythonLastLines ]
    singleLineLog(updatedLog.join('\n'))
  }, 2500)
}

function stopLog () {
  clearInterval(lastLinesInterval)
}

function installBuildTools () {
  return new Promise((resolve, reject) => {
    const tailer = new Tailer()

    tailer.on('exit', (result, details) => {
      debug('Install: Build tools tailer exited')

      if (result === 'error') {
        debug('Installer: Tailer found error with installer', details)
        reject(new Error(`Found error with VCC installer: ${details}`))
      }

      if (result === 'success') {
        vccLastLines = [ chalk.bold.green('ully installed Visual Studio Build Tools.') ]
        debug('Installer: Successfully installed Visual Studio Build Tools according to tailer')
        resolve()
      }

      if (result === 'failure') {
        log(chalk.bold.red('Could not install Visual Studio Build Tools.'))
        log('Please find more details in the log files, which can be found at')
        log(getWorkDirectory())
        debug('Installer: Failed to install according to tailer')
        resolve()
      }
    })

    tailer.start()
  })
}

function installPython () {
  return new Promise((resolve, reject) => {
    // The log file for msiexe is utf-16
    const tailer = new Tailer(getPythonInstallerPath().logPath, 'ucs2')

    tailer.on('exit', (result, details) => {
      debug('python tailer exited')
      if (result === 'error') {
        debug('Installer: Tailer found error with installer', details)
        reject(new Error(`Found error with Python installer: ${details}`))
      }

      if (result === 'success') {
        pythonLastLines = [ chalk.bold.green('Successfully installed Python 2.7') ]
        debug('Installer: Successfully installed Python 2.7 according to tailer')

        var variables = {
          pythonPath: details || getPythonInstallerPath().targetPath
        }
        resolve(variables)
      }

      if (result === 'failure') {
        log(chalk.bold.red('Could not install Python 2.7.'))
        log('Please find more details in the log files, which can be found at')
        log(getWorkDirectory())
        debug('Installer: Failed to install Python 2.7 according to tailer')
        resolve(undefined)
      }
    })

    tailer.start()
  })
}

module.exports = install
