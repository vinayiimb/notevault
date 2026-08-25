#!/bin/bash
set -e

# Load .env.local
export $(grep -v '^#' .env.local | xargs)

# Function to put secret
put_secret() {
  local key=$1
  local value="${!key}"
  if [ -n "$value" ]; then
    echo "Uploading $key..."
    echo "$value" | npx wrangler secret put "$key"
  else
    echo "Skipping $key (empty)"
  fi
}

put_secret DATABASE_URL
put_secret DATABASE_URL_UNPOOLED
put_secret GROQ_API_KEY
put_secret JWT_SECRET
put_secret REVALIDATE_SECRET
put_secret R2_ACCESS_KEY_ID
put_secret R2_SECRET_ACCESS_KEY
put_secret R2_ACCOUNT_ID
put_secret R2_BUCKET_NAME
put_secret R2_ENDPOINT
put_secret R2_PUBLIC_URL
put_secret ADMIN_SEED_EMAIL
put_secret ADMIN_SEED_PASSWORD

echo "Secrets uploaded!"
