#!/bin/sh
set -eu

# Run pending database migrations using the bundled Prisma CLI.
node ./node_modules/prisma/build/index.js migrate deploy

# Start the Next.js standalone server.
exec node server.js
