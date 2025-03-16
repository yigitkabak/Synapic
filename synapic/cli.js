#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');

const appPath = path.join(__dirname, 'app.js');
spawn('node', [appPath], { cwd: __dirname, stdio: 'inherit' });