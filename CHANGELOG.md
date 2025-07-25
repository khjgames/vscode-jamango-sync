# Changelog

All notable changes to the Jamango Sync VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial extension development
- Real-time file watching with Chokidar
- WebSocket communication with Jamango website
- Status bar integration with sync toggle
- Command palette integration
- Configurable file extensions
- Cross-platform support

### Planned
- File content synchronization
- Conflict resolution
- Batch file operations
- Extension marketplace publishing

## [0.1.0] - 2024-01-XX

### Added
- Initial release of Jamango Sync extension
- Basic file watching functionality
- WebSocket connection to Jamango website
- Status bar indicator
- Command palette commands:
  - Start Jamango Sync
  - Stop Jamango Sync
  - Sync Files Now
- Configuration options:
  - Website URL setting
  - Sync interval setting
  - Watch extensions setting
- Support for common file types (.js, .ts, .lua, .py, .html, .css, .json, .txt)
- Error handling and user notifications
- Debug logging support

### Technical Details
- Built with VS Code Extension API
- Uses Chokidar for file watching
- WebSocket communication for real-time updates
- Status bar integration for user feedback
- Command palette integration for easy access 