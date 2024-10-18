const chalk = require('chalk');

const logger = {
  error: (...args) => console.error(chalk.red('ERROR:'), ...args),
  warn: (...args) => console.warn(chalk.yellow('WARN:'), ...args),
  info: (...args) => console.info(chalk.cyan('INFO:'), ...args),
  success: (...args) => console.log(chalk.green('SUCCESS:'), ...args),
  debug: (...args) => console.debug(chalk.blue('DEBUG:'), ...args),
};

module.exports = logger;
