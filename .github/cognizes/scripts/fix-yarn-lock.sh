#!/bin/bash

# Script to fix yarn.lock file by replacing private registry URLs with public ones
set -e

WORKING_DIRECTORY=${1:-.}
YARN_LOCK_FILE="${WORKING_DIRECTORY}/yarn.lock"

if [ ! -f "$YARN_LOCK_FILE" ]; then
    echo "No yarn.lock file found at $YARN_LOCK_FILE"
    exit 0
fi

echo "Fixing yarn.lock file to use public npm registry..."

# Replace private registry URLs with public ones
sed -i.bak 's|https://nexus\.automizely\.org/repository/npm-group/|https://registry.npmjs.org/|g' "$YARN_LOCK_FILE"

echo "Successfully updated yarn.lock file"
echo "Original file backed up as ${YARN_LOCK_FILE}.bak"