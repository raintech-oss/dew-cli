#!/usr/bin/env node

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const findUp = require('find-up')
const fs = require('fs')
const configPath = findUp.sync(['.dew', '.dew.json'])
const config = configPath ? JSON.parse(fs.readFileSync(configPath)) : {}

const argv = yargs(hideBin(process.argv))
  .config(config)
  .commandDir('cmds')
  .demandCommand()
  .coerce('credentials', function (arg) {
    return JSON.parse(fs.readFileSync(arg))
  })  
  .help()
  .argv

// console.log(argv)