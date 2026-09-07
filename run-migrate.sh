#!/bin/bash
set -e

cd "$(dirname "$0")"

backups_dir="./backups/renames/$(date +%F_%H-%M-%S)"
echo "Backups dir: $backups_dir"

node --loader ./scripts/migrate-collections.js --backups-dir "$backups_dir" --renames '[{"from":"clients","to":"customerProfiles"},{"from":"pets","to":"dogs"},{"from":"client","to":"customer"}]' --yes --project pet-1cb0b --verify-only 2>&1 | head -100
