#!/bin/bash

# Script to launch all services in separate terminal tabs/windows
# Works on macOS (Terminal.app) and Linux (gnome-terminal)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use osascript to open Terminal tabs
    echo "Opening services in Terminal tabs (macOS)..."
    
    # Use Terminal.app (more reliable than iTerm2 AppleScript)
    # iTerm2 users can manually arrange windows or use iTerm2's built-in window management
    echo "Using Terminal.app..."
    osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$SCRIPT_DIR/centralApi' && echo 'Starting Central API...' && node dev-start.js"
    delay 0.3
    tell application "System Events" to keystroke "t" using {command down}
    delay 2.0
    do script "cd '$SCRIPT_DIR/centralFederatedClient' && echo 'Starting Central Federated Client...' && node dev-start.js" in front window
    delay 0.3
    tell application "System Events" to keystroke "t" using {command down}
    delay 0.3
    do script "cd '$SCRIPT_DIR/fileServer' && echo 'Starting File Server...' && node dev-start.js" in front window
    delay 0.3
    tell application "System Events" to keystroke "t" using {command down}
    delay 0.3
    do script "cd '$SCRIPT_DIR/desktopApp/reactApp' && echo 'Starting React App (Webpack)...' && npm start" in front window
end tell
EOF
    
    echo "All services launched in separate Terminal tabs!"
    echo "Check each tab for service logs."
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try gnome-terminal first, fall back to xterm
    echo "Opening services in terminal windows (Linux)..."
    
    if command -v gnome-terminal &> /dev/null; then
        # Use gnome-terminal with tabs
        gnome-terminal --tab --title="Central API" -- bash -c "cd '$SCRIPT_DIR/centralApi' && echo 'Starting Central API...' && node dev-start.js; exec bash" \
                     --tab --title="Central Federated Client" -- bash -c "sleep 2 && cd '$SCRIPT_DIR/centralFederatedClient' && echo 'Starting Central Federated Client...' && node dev-start.js; exec bash" \
                     --tab --title="File Server" -- bash -c "cd '$SCRIPT_DIR/fileServer' && echo 'Starting File Server...' && node dev-start.js; exec bash" \
                     --tab --title="React App (Webpack)" -- bash -c "cd '$SCRIPT_DIR/desktopApp/reactApp' && echo 'Starting React App (Webpack)...' && npm start; exec bash"
        echo "All services launched in gnome-terminal tabs!"
    elif command -v xterm &> /dev/null; then
        # Fall back to xterm (opens separate windows)
        xterm -T "Central API" -e "cd '$SCRIPT_DIR/centralApi' && node dev-start.js" &
        sleep 2
        xterm -T "Central Federated Client" -e "cd '$SCRIPT_DIR/centralFederatedClient' && node dev-start.js" &
        xterm -T "File Server" -e "cd '$SCRIPT_DIR/fileServer' && node dev-start.js" &
        xterm -T "React App (Webpack)" -e "cd '$SCRIPT_DIR/desktopApp/reactApp' && npm start" &
        echo "All services launched in xterm windows!"
    else
        echo "Error: No supported terminal found. Please install gnome-terminal or xterm."
        echo "Or manually open terminals and run:"
        echo "  cd centralApi && node dev-start.js"
        echo "  cd centralFederatedClient && node dev-start.js"
        echo "  cd fileServer && node dev-start.js"
        echo "  cd desktopApp/reactApp && npm start"
        exit 1
    fi
else
    echo "Unsupported OS: $OSTYPE"
    echo "Please manually open terminals and run:"
    echo "  cd centralApi && node dev-start.js"
    echo "  cd centralFederatedClient && node dev-start.js"
    echo "  cd fileServer && node dev-start.js"
    echo "  cd desktopApp/reactApp && npm start"
    exit 1
fi

