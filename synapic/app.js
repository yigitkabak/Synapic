#!/usr/bin/env node

// This is the executable script when installed globally
const Synapic = require('./index');

console.log('Synapic CLI Starting...');

function runApp() {
  console.log(`
  ===================================
   SYNAPIC APPLICATION
  ===================================
  
  The Synapic module is now running.
  This app can be started directly after using npm link.
  
  Current directory: ${process.cwd()}
  `);
  
  // Example usage of the module itself
  const result = Synapic.initialize({
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date()
  });
  
  console.log('Initialization result:', result);
  
  // Process some sample data
  const processResult = Synapic.process({
    sample: 'data',
    value: Math.random() * 100
  });
  
  console.log('Process result:', processResult);
}

// Run the application
runApp();