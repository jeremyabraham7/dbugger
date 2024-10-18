const axios = require('axios');
const logger = require('../logger');

let isAnalyzing = false;

async function anthropicHandler(errorContext, config) {
  if (isAnalyzing) return null;
  isAnalyzing = true;

  const { anthropic_api_key, anthropic_model } = config;

  if (!anthropic_api_key) {
    logger.warn('Anthropic API key not configured, skipping Anthropic handler');
    isAnalyzing = false;
    return null;
  }

  const prompt = `Analyze the following error log and provide a brief explanation/possible cause of the issue:

Process: ${errorContext.processName}
Branch: ${errorContext.branch}
User: ${errorContext.user}
Commit: ${errorContext.commit}
Log:
${errorContext.log}

Please be very concise and to the point, no more than 2 sentences. User's are very technical and don't need long explanations.`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: anthropic_model || 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropic_api_key,
          'anthropic-version': '2023-06-01'
        },
      }
    );

    const analysis = response.data.content[0].text;
    logger.info('Anthropic Analysis:', analysis);

    return analysis;
  } catch (error) {
    logger.error('Failed to get analysis from Anthropic:', error.response ? JSON.stringify(error.response.data) : error.message);
    throw error;
  } finally {
    isAnalyzing = false;
  }
}

module.exports = anthropicHandler;
