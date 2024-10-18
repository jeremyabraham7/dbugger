const axios = require('axios');
const logger = require('../logger');

const MAX_MESSAGE_LENGTH = 39000; // Slightly below Slack's 40,000 character limit

function truncateMessage(message, maxLength) {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength - 3) + '...';
}

async function slackHandler(errorContext, config) {
  const { slack_webhook_url } = config;
  
  let messageText = `*ERROR IN ${errorContext.processName.toUpperCase()} :lul:*\n`;

  // Add analysis to the message if available
  if (errorContext.ai_analysis) {
    messageText += `\n${errorContext.ai_analysis}\n\n\n\n`;
  }

  messageText += `*Branch:* ${errorContext.branch}\n`;
  messageText += `*User:* ${errorContext.user}\n`;
  messageText += `*Commit:* ${errorContext.commit}\n`;

  // Calculate remaining space for log
  const remainingSpace = MAX_MESSAGE_LENGTH - messageText.length - 10; // 8 for the ```...``` wrapper
  const truncatedLog = truncateMessage(errorContext.log, remainingSpace);
  const escapedLog = truncatedLog.replace(/`/g, '\\`');
  messageText += `*Log:*\n\n\`\`\`${escapedLog}\`\`\``;

  // Ensure the entire message is within the limit
  messageText = truncateMessage(messageText, MAX_MESSAGE_LENGTH);

  const message = {
    text: messageText,
    mrkdwn: true
  };

  try {
    const response = await axios.post(slack_webhook_url, message);
    if (response.status === 200) {
      return true;
    } else {
      logger.error('Failed to send message to Slack. Status:', response.status);
      return false;
    }
  } catch (error) {
    logger.error('Failed to send message to Slack:', error.message);
    if (error.response) {
      logger.error('Slack API response:', error.response.data);
    }
    return false;
  }
}

module.exports = slackHandler;
