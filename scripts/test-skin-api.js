#!/usr/bin/env node
/**
 * Test script for the analyze-skin Supabase Edge Function
 *
 * Usage:
 *   node scripts/test-skin-api.js                  # run connectivity test with synthetic image
 *   node scripts/test-skin-api.js /path/to/face.jpg # run with a real image
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://nkkqsiyeiqvxaojyythz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ra3FzaXllaXF2eGFvanl5dGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTg2MTUsImV4cCI6MjA5MTE3NDYxNX0.QSZKtTUgrhWz7D_l1cvtv_FRZtNNkDgi61G1k-UYA_c';
const ENDPOINT = `${SUPABASE_URL}/functions/v1/analyze-skin`;

// Minimal 1×1 JPEG — used only for connectivity/error-path testing
const SYNTHETIC_1X1_JPEG =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFgAB' +
  'AQEAAAAAAAAAAAAAAAAABgUEB//EAB8QAAICAgMBAQAAAAAAAAAAAAECAwQFERIhMf/EABQBAQAAAA' +
  'AAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Amxo7GytYYoYI' +
  'o0ijUKiKMBQPAAHgD8V//9k=';

async function callAnalyzeSkin(image_base64, label) {
  console.log(`\n--- ${label} ---`);
  console.log(`Image base64 length: ${image_base64.length} chars`);

  const start = Date.now();
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ image_base64 }),
    });
  } catch (err) {
    console.error('Network error:', err.message);
    return;
  }

  const elapsed = Date.now() - start;
  console.log(`HTTP status: ${res.status} (${elapsed}ms)`);

  let body;
  try {
    body = await res.json();
  } catch {
    const text = await res.text().catch(() => '<unreadable>');
    console.error('Response was not JSON:', text);
    return;
  }

  if (!res.ok) {
    console.error('API error response:', JSON.stringify(body, null, 2));
    return;
  }

  console.log('\nAnalysis result:');
  console.log(JSON.stringify(body, null, 2));

  // Summary
  if (body.skin_type) {
    console.log('\nQuick summary:');
    console.log(`  Skin type     : ${body.skin_type}`);
    console.log(`  Acne type     : ${body.acne_type}`);
    console.log(`  Severity      : ${body.severity} (score ${body.severity_score ?? 'n/a'}/100)`);
    console.log(`  Confidence    : ${body.confidence ?? 'n/a'}`);
    if (body.zones) {
      console.log('  Zones:');
      for (const [zone, data] of Object.entries(body.zones)) {
        console.log(`    ${zone.padEnd(12)}: ${data.severity} — ${data.note}`);
      }
    }
  }
}

async function main() {
  const imagePath = process.argv[2];

  if (imagePath) {
    const resolved = path.resolve(imagePath);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      process.exit(1);
    }
    const buf = fs.readFileSync(resolved);
    const base64 = buf.toString('base64');
    await callAnalyzeSkin(base64, `Real image: ${path.basename(resolved)}`);
  } else {
    console.log('No image path provided — running connectivity test with synthetic 1×1 JPEG.');
    console.log('For a real analysis, run:  node scripts/test-skin-api.js /path/to/face.jpg\n');
    await callAnalyzeSkin(SYNTHETIC_1X1_JPEG, 'Synthetic 1×1 JPEG (connectivity test)');
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
