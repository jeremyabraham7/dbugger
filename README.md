# dbugger

dbugger is a debugging tool that monitors your application logs, detects errors, and provides intelligent analysis using AI. It integrates with Slack for real-time notifications and uses Claude AI for in-depth error analysis.

I created this to help automatically bug Devon with my local errors (the d in dbugger), the backend engineer I typically work with. It ended up being useful.

## Features

- Real-time log monitoring
- Error detection based on customizable keywords
- Slack integration for instant notifications
- AI-powered error analysis using Claude
- Currently supports PM2 logging but more adapters will be added soon!

## Installation

1. Clone this repository or add it as a submodule to your project:
   ```
   git clone https://github.com/your-username/dbugger.git
   ```
   or
   ```
   git submodule add https://github.com/your-username/dbugger.git
   ```

2. Install dependencies:
   ```
   cd dbugger
   npm install
   ```

3. Initialize dbugger in your repository:
   ```
   dbugger init
   ```
   This command adds an example config file and updates your .gitignore.

4. Edit `.dbugger.config` with your specific settings:
   - `pm2_process_name`: The name of your PM2 process to monitor
   - `slack_webhook_url`: Your Slack webhook URL for notifications
   - `slack_channel`: The Slack channel to send notifications to
   - `error_keywords`: An array of keywords to detect in logs
   - `anthropic_api_key`: Your Anthropic API key for Claude AI
   - `anthropic_model`: The Claude model to use (e.g., "claude-3-sonnet-20240229")

## Usage

dbugger provides the following commands:

`dbugger init`: Initialize dbugger in your repository. This adds an example config file and updates your .gitignore.

`dbugger send`: Find the last error in your logs and send it to Slack with AI analysis.

`dbugger`: Start monitoring your application logs based on the settings in your .dbugger.config file. This command will continuously watch for errors, send notifications to Slack, and provide AI-powered analysis when errors are detected.

To use dbugger, simply run the appropriate command in your terminal. For example, to start monitoring your logs:

```
dbugger
```

This command will continuously watch your application logs, detect errors, and send notifications to Slack when errors are detected.

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.