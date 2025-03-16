const { execSync } = require('child_process');
const path = require('path');

// Function to execute commands and print output
function runCommand(command) {
  console.log(`> ${command}`);
  try {
    const output = execSync(command, { stdio: 'inherit' });
    return output;
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error);
    process.exit(1);
  }
}

// Main function to set up and run the application
function setupAndRun() {
  console.log('Setting up npm link...');
  runCommand('npm link');
  
  console.log('Changing to synapic directory...');
  const synapicPath = path.join(__dirname, 'synapic');
  process.chdir(synapicPath);
  console.log(`Current directory: ${process.cwd()}`);
  
  console.log('Running the application...');
  runCommand('node app.js');
}

// Run the setup
setupAndRun();
