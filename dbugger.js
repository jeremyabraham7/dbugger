#!/usr/bin/env node

const { program } = require('commander');
const pm2 = require('pm2');
const fs = require('fs-extra');
const simpleGit = require('simple-git');
const path = require('path');
const logger = require('./logger');
const slackHandler = require('./handlers/slack');
const anthropicHandler = require('./handlers/anthropic');

let isExecuting = false;

program
  .version('1.0.0')
  .option('-c, --config <path>', 'Set config file path', '.dbugger.config');

program
  .command('init')
  .description('Initialize dbugger configuration')
  .action(async () => {
    if (isExecuting) return;
    isExecuting = true;
    await initializeConfig();
    process.exit(0);
  });

program
  .command('send')
  .description('Send the last error')
  .action(async () => {
    if (isExecuting) return;
    isExecuting = true;
    const config = await loadConfig(program.opts().config);
    await send(config);
    process.exit(0);
  });

program
  .action(async (options) => {
    if (isExecuting) return;
    isExecuting = true;
    const config = await loadConfig(options.config);
    startMonitoring(config);
  });

program.parse(process.argv);

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function loadConfig(configPath) {
  const resolvedPath = path.resolve(process.cwd(), configPath);
  if (!await fs.pathExists(resolvedPath)) {
    logger.error('Configuration file not found:', resolvedPath);
    process.exit(1);
  }
  return await fs.readJson(resolvedPath);
}

function startMonitoring(config) {
  const { pm2_process_name, error_keywords } = config;
  
  // Debounced handleError function
  const debouncedHandleError = debounce((logData, config) => {
    logger.warn('Error keyword detected, handling error...');
    handleError(logData, config);
  }, 5000); // 5 second debounce

  // Connect to pm2
  pm2.connect(function(err) {
    if (err) {
      logger.error('Failed to connect to pm2:', err);
      process.exit(2);
    }

    // Launch log stream
    pm2.launchBus(function(err, bus) {
      if (err) {
        logger.error('Failed to launch pm2 bus:', err);
        process.exit(3);
      }
      logger.success('Connected to pm2 log stream');

      bus.on('log:out', function(packet) {
        if (packet.process.name === pm2_process_name) {
          const logData = packet.data;
          logger.debug('[PM2 Log]', logData);
          // Check for error keywords
          if (error_keywords.some(keyword => logData.includes(keyword))) {
            debouncedHandleError(logData, config);
          }
        }
      });
    });
  });
}

async function handleError(logData, config) {
  const git = simpleGit();
  
  try {
    const userName = await git.raw(['config', 'user.name']);
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    const commitInfo = await git.log(['-1', '--pretty=format:%h - %s']);

    const errorContext = {
      processName: config.pm2_process_name,
      branch: branch.trim(),
      user: userName.trim(),
      commit: commitInfo.latest ? `${commitInfo.latest.hash} - ${commitInfo.latest.message}` : 'unknown',
      log: logData
    };

    let analysis;
    try {
      logger.info('Requesting AI analysis...');
      analysis = await anthropicHandler(errorContext, config);
      logger.success('AI analysis received');
      errorContext.ai_analysis = analysis;
    } catch (anthropicError) {
      logger.error('Error in Anthropic handler:', anthropicError);
    }

    logger.info('Sending error to Slack...');
    const slackResult = await slackHandler(errorContext, config);
    if (slackResult) {
      logger.success('Error sent to Slack');
    } else {
      logger.error('Failed to send error to Slack');
    }
  } catch (error) {
    logger.error('Error while handling error:', error);
  }
}

async function send(config) {
  const { pm2_process_name, error_keywords } = config;

  try {
    const logs = await new Promise((resolve, reject) => {
      pm2.connect(async (err) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const processDescription = await new Promise((resolve, reject) => {
            pm2.describe(pm2_process_name, (err, desc) => {
              if (err) reject(err);
              else resolve(desc);
            });
          });

          if (!processDescription || processDescription.length === 0) {
            reject(new Error(`Process ${pm2_process_name} not found`));
            return;
          }

          const logFile = processDescription[0].pm2_env.pm_out_log_path;
          const data = await fs.readFile(logFile, 'utf8');
          resolve(data);
        } catch (error) {
          reject(error);
        } finally {
          pm2.disconnect();
        }
      });
    });

    const logLines = logs.split('\n').reverse();
    let errorStart = -1;
    let errorEnd = -1;

    // Find the last occurrence of an error keyword
    for (let i = 0; i < logLines.length; i++) {
      if (error_keywords.some(keyword => logLines[i].includes(keyword))) {
        errorEnd = i;
        break;
      }
    }

    if (errorEnd === -1) {
      logger.warn('No recent errors found in the logs.');
      return;
    }

    // Find the start of the error (look for a line with a timestamp)
    const timestampRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:/;
    for (let i = errorEnd; i < logLines.length; i++) {
      if (timestampRegex.test(logLines[i])) {
        errorStart = i;
        break;
      }
    }

    // If we couldn't find a clear start, use a fixed number of lines
    if (errorStart === -1 || errorStart - errorEnd > 200) {
      errorStart = Math.min(errorEnd + 200, logLines.length - 1);
    }

    const errorLog = logLines.slice(errorEnd, errorStart + 1).reverse().join('\n');
    await handleError(errorLog, config);

  } catch (error) {
    logger.error('Error in send function:', error);
  }
}

async function initializeConfig() {
  const configPath = path.resolve(process.cwd(), '.dbugger.config');
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');

  // Example configuration
  const exampleConfig = {
    pm2_process_name: "your_process_name",
    slack_webhook_url: "your_slack_webhook_url",
    slack_channel: "your_slack_channel",
    error_keywords: ["error", "exception", "fail", "StripeInvalidRequestError"],
    anthropic_api_key: "your_anthropic_api_key",
    anthropic_model: "claude-3-sonnet-20240229"
  };

  try {
    // Check if .dbugger.config already exists
    if (await fs.pathExists(configPath)) {
      logger.info('.dbugger.config already exists. Skipping creation.');
    } else {
      // Create .dbugger.config
      await fs.writeJson(configPath, exampleConfig, { spaces: 2 });
      logger.success('Created .dbugger.config with example configuration.');
    }

    // Add .dbugger.config to .gitignore if it's not already there
    let gitignoreContent = '';
    if (await fs.pathExists(gitignorePath)) {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    }

    if (!gitignoreContent.includes('.dbugger.config')) {
      await fs.appendFile(gitignorePath, '\n.dbugger.config\n');
      logger.success('Added .dbugger.config to .gitignore');
    } else {
      logger.info('.dbugger.config is already in .gitignore');
    }

    logger.info('Initialization complete. Please edit .dbugger.config with your actual configuration.');
  } catch (error) {
    logger.error('Error during initialization:', error);
  }
}

if (require.main === module) {
  program.parse(process.argv);
}

module.exports = { send };
