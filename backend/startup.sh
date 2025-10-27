#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# This script is run by Render to start the application.

echo "--- Waiting for database to be ready ---"
# This loop will try to run a simple command. If it fails, it waits 5 seconds and tries again.
# This prevents the app from crashing if the database isn't ready immediately.
until python -c 'from server import app, db; app.app_context().push(); db.engine.connect()'; do
  echo "Database is unavailable - sleeping"
  sleep 5
done
echo "--- Database is ready. Creating tables (if they don't exist). ---"
python -c 'from server import app, db; app.app_context().push(); db.create_all()'

echo "--- Starting Gunicorn server ---"
gunicorn server:app