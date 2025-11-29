#!/bin/bash

# Apply database migrations
echo "Applying database migrations..."
prisma migrate deploy

# Initialize Vector DB (Set dimension and create index)
echo "Initializing Vector DB..."
python init_vector_db.py

# Start Backend
python api.py &

# Start Frontend (Node.js is needed for Next.js standalone)
# Copy custom server.js to standalone directory
cp web/server.js web/standalone/server.js

cd web/standalone
node server.js