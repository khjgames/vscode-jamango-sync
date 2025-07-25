<div align='center'>
  <img alt='Jamango Sync Logo' src='https://jamango.io/assets/frontend/ka.webp'>
</div>

# ⚠️ Disclaimer

**This is an unofficial, community-created extension. Not affiliated with or endorsed by Jamango.**

---

# Jamango Sync

Real-time file synchronization between VS Code and the Jamango website platform. Automatically syncs your script files for seamless development workflow.

## 🧪 Test the Extension

**Try the live demo website:** [https://khjgames.github.io/vscode-jamango-sync/website_example/index.html](https://khjgames.github.io/vscode-jamango-sync/website_example/index.html)

Click "Sync Folder" to connect to your VS Code extension and see real-time file synchronization in action!

### 🔐 HTTPS Compatibility
The extension creates a local HTTP WebSocket server and uses a public HTTPS proxy service for GitHub Pages compatibility:

- **Local development**: Connect directly to `ws://localhost:8080`
- **GitHub Pages**: Connect via public HTTPS proxy service
- **Automatic fallback**: Tries multiple connection methods

**For GitHub Pages users**: The extension automatically bridges your local files to the HTTPS website through a secure proxy service.

## About
Jamango Sync is a community-created VS Code extension that provides real-time file synchronization between your local development environment and the Jamango website. This extension monitors your workspace for file changes and automatically syncs both file names and file contents to your Jamango project, including all subfolders and maintaining the complete folder structure. This is an unofficial tool created independently by a community member.

## Features
* **Real-time file watching** - Automatically detects file changes, additions, and deletions
* **File content synchronization** - Syncs both file names and complete file contents
* **Subfolder support** - Monitors and syncs all subfolders within your workspace
* **Folder structure preservation** - Maintains complete directory structure and relative paths
* **WebSocket communication** - Fast, efficient updates to your Jamango website
* **Status bar integration** - Visual indicator of sync status with one-click toggle
* **Configurable file types** - Watch specific file extensions (.json, .css, .html, .txt, .ts, .tsx, etc.)
* **Command palette integration** - Easy access to sync commands
* **Cross-platform support** - Works on Windows, Mac, and Linux

## Installation
1. Install the extension from the VS Code Marketplace
2. Open a folder in VS Code (your project directory)
3. Use Command Palette (`Ctrl+Shift+P`) and run "Start Jamango Sync"
4. Configure your Jamango website URL in settings

## Usage

### Quick Start
1. **Open your project folder** in VS Code
2. **Click the Jamango Sync status bar item** (bottom-right) or use Command Palette
3. **Edit your files** - changes and file contents are automatically synced
4. **View sync status** in the status bar and notifications

### Commands
* **Start Jamango Sync** - Begin watching files and syncing with website
* **Stop Jamango Sync** - Stop file watching and disconnect from website
* **Sync Files Now** - Manually trigger a file sync

### Configuration
Open VS Code settings and search for "Jamango Sync" to configure:
* **Website URL** - Your Jamango website address (default: http://localhost:3000)
* **Sync Interval** - How often to check for changes (default: 5000ms)
* **Watch Extensions** - File types to monitor (default: .json, .css, .html, .txt, .ts, .tsx)

## Links
* **VS Code Extension** - [Marketplace](https://marketplace.visualstudio.com/items?itemName=KHJGames.jamango-sync)
* **GitHub Repository** - [Source Code](https://github.com/khjgames/vscode-jamango-sync)

## Technical Details

### How It Works
1. **File Watcher** - Uses Chokidar to monitor your workspace for file changes
2. **Content Reading** - Reads complete file contents when changes are detected
3. **WebSocket Connection** - Maintains real-time connection with your Jamango website
4. **Data Transmission** - Sends folder / file contents to the website
5. **Structure Preservation** - Maintains relative paths and folder hierarchy
6. **Status Management** - Provides visual feedback and error handling

### Supported File Types
* JSON (.json)
* CSS (.css)
* HTML (.html)
* Text (.txt)
* TypeScript (.ts, .tsx)
* And more (configurable)

### Security
* **Local connections only** - Extension only connects to localhost by default
* **Configurable endpoints** - You control where the extension connects

## Troubleshooting

### Common Issues
* **"No workspace folder found"** - Make sure you have a folder open in VS Code
* **"Failed to connect to website"** - Check your website URL and ensure the site is running
* **"Extension not working"** - Try restarting VS Code or reinstalling the extension

### Debug Mode
Enable debug logging by opening VS Code Developer Tools (`Help > Toggle Developer Tools`) and checking the Console tab for detailed information.

## Development

### Building from Source
```bash
git clone https://github.com/khjgames/vscode-jamango-sync
cd vscode-jamango-sync
npm install
npm run lint
```

### Testing
```bash
npm test
```

## Changelog
See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License
ISC License - see LICENSE file for details.

## Support
* **GitHub Issues** - [Report bugs](https://github.com/khjgames/vscode-jamango-sync/issues)

 