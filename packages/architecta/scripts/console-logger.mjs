#!/usr/bin/env node
/**
 * Browser Console Logger
 *
 * Launches Chrome and captures all console logs from localhost:3000
 * Run with: node scripts/console-logger.mjs
 */

import puppeteer from 'puppeteer';

const URL = process.argv[2] || 'http://localhost:3000';

async function main() {
  console.log(`\n🔍 Console Logger - Watching ${URL}\n`);
  console.log('─'.repeat(60));

  const browser = await puppeteer.launch({
    headless: false, // Show the browser so you can interact
    defaultViewport: null, // Use full window size
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();

  // Capture console messages
  page.on('console', (msg) => {
    const type = msg.type().toUpperCase().padEnd(7);
    const timestamp = new Date().toLocaleTimeString();
    const text = msg.text();

    // Color coding
    let prefix = '';
    switch (msg.type()) {
      case 'error':
        prefix = '\x1b[31m'; // Red
        break;
      case 'warning':
        prefix = '\x1b[33m'; // Yellow
        break;
      case 'info':
        prefix = '\x1b[36m'; // Cyan
        break;
      default:
        prefix = '\x1b[37m'; // White
    }

    console.log(`${prefix}[${timestamp}] ${type}\x1b[0m ${text}`);
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    console.log(`\x1b[31m[${new Date().toLocaleTimeString()}] PAGE ERROR\x1b[0m`, error.message);
  });

  // Capture request failures
  page.on('requestfailed', (request) => {
    console.log(`\x1b[31m[${new Date().toLocaleTimeString()}] REQUEST FAILED\x1b[0m ${request.url()}`);
  });

  // Navigate to the page
  await page.goto(URL, { waitUntil: 'networkidle2' });

  console.log('\n✅ Watching for console logs... (Ctrl+C to stop)\n');
  console.log('─'.repeat(60));

  // Keep the script running
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('Failed to start console logger:', err);
  process.exit(1);
});
