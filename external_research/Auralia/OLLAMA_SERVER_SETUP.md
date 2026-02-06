# Ollama Server Configuration Guide

## Overview

The Voice Assistant app now supports dynamic configuration of the Ollama server URL, so your friends don't need to manually change the code to use their own server IP addresses.

## How to Configure Your Server URL

### Method 1: Through the App Settings (Recommended)

1. **Open the Voice Assistant app**
2. **Navigate to Settings** (tap the menu icon in the top-left corner)
3. **Scroll down to "Server Configuration" section**
4. **Tap "Ollama Server URL"**
5. **Enter your server URL** in the format: `http://YOUR_IP_ADDRESS:11434/`
   - Example: `http://192.168.1.100:11434/`
   - Example: `http://10.0.0.50:11434/`
6. **Tap "Save Configuration"**
7. **The app will now use your custom server URL**

### Method 2: Reset to Default

If you want to use the default server URL:
1. Go to Server Configuration
2. Tap "Reset to Default"
3. Confirm the reset

## Finding Your Computer's IP Address

### On Windows:
1. Open Command Prompt
2. Type: `ipconfig`
3. Look for "IPv4 Address" under your active network adapter
4. Use that IP address in the server URL

### On macOS:
1. Open System Preferences > Network
2. Select your active connection
3. Note the IP address shown
4. Use that IP address in the server URL

### On Linux:
1. Open Terminal
2. Type: `ip addr show` or `ifconfig`
3. Look for your network interface and note the IP address
4. Use that IP address in the server URL

## Requirements

- **Ollama must be running** on your computer
- **Your phone and computer must be on the same network**
- **Port 11434 must be accessible** (Ollama's default port)

## Troubleshooting

### "Cannot connect to Ollama server" Error
1. Make sure Ollama is running on your computer
2. Verify the IP address is correct
3. Check that your phone and computer are on the same network
4. Try pinging the IP address from your phone to test connectivity

### "Request timed out" Error
1. The model might be taking too long to respond
2. Try a smaller/faster model
3. Check your computer's performance

### "Network error" Error
1. Check your network connection
2. Verify the server URL format is correct
3. Make sure no firewall is blocking the connection

## Default Configuration

The default server URL is: `http://192.168.1.116:11434/`

This can be changed in the `NetworkConfig.kt` file if needed for your development environment.

## Benefits

- ✅ **No code changes required** for different users
- ✅ **Easy configuration** through the app interface
- ✅ **Persistent settings** - URL is saved between app launches
- ✅ **Reset functionality** to return to default settings
- ✅ **Visual feedback** showing current configuration status 