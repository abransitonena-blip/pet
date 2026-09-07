#!/bin/bash
set -e

echo "=== Testing migration verification script ==="

echo "\n1. Testing --verify-only mode"
node scripts/migrate-collections.js \
  --backups-dir ./backups \
  --renames '[{"from":"clients","to":"customerProfiles"},{"from":"pets","to":"dogs"}]' \
  --verify-only \
  --project test-project \
  --emulator 2>&1 | head -50

echo "\n=== Test completed ==="
