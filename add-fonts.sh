#!/bin/bash

echo "Satoshi Font Setup Script"
echo "========================="
echo ""
echo "This script will help you add Satoshi font files."
echo ""
echo "Step 1: Make sure you have Satoshi font files (.woff2 format)"
echo "        If you have .otf or .ttf files, convert them first."
echo ""
read -p "Do you have Satoshi .woff2 files ready? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please enter the path to your font files directory:"
    echo "Example: ~/Downloads/fonts or /path/to/fonts"
    read font_path
    
    if [ -d "$font_path" ]; then
        echo ""
        echo "Copying font files..."
        
        # Copy to web app
        cp "$font_path"/Satoshi-Regular.woff2 web/public/fonts/ 2>/dev/null || echo "Warning: Satoshi-Regular.woff2 not found"
        cp "$font_path"/Satoshi-Medium.woff2 web/public/fonts/ 2>/dev/null || echo "Warning: Satoshi-Medium.woff2 not found"
        cp "$font_path"/Satoshi-Bold.woff2 web/public/fonts/ 2>/dev/null || echo "Warning: Satoshi-Bold.woff2 not found"
        
        # Copy to extension
        cp "$font_path"/Satoshi-Regular.woff2 extension/fonts/ 2>/dev/null || echo "Warning: Satoshi-Regular.woff2 not found"
        cp "$font_path"/Satoshi-Medium.woff2 extension/fonts/ 2>/dev/null || echo "Warning: Satoshi-Medium.woff2 not found"
        cp "$font_path"/Satoshi-Bold.woff2 extension/fonts/ 2>/dev/null || echo "Warning: Satoshi-Bold.woff2 not found"
        
        echo ""
        echo "Checking copied files..."
        ls -lh web/public/fonts/
        echo ""
        ls -lh extension/fonts/
        echo ""
        echo "Done! Restart your dev server and refresh the browser."
    else
        echo "Error: Directory not found: $font_path"
    fi
else
    echo ""
    echo "Please get Satoshi font files first."
    echo "See ADD_SATOSHI_FONTS.md for instructions."
fi
