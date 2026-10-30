#!/usr/bin/env bash
# Starts a single-node MongoDB replica set for Kalaa on port 27018, data in .data/mongo.
# Separate from any mongod you already run on 27017. Transactions need a replica set; this gives
# local development the same behaviour as Atlas. Usage: npm run db:local   (stays in the foreground)
set -euo pipefail
cd "$(dirname "$0")/.."
MONGOD="${MONGOD:-$(command -v mongod || echo /opt/homebrew/opt/mongodb-community@7.0/bin/mongod)}"
PORT="${KALAA_MONGO_PORT:-27018}"
DIR=".data/mongo"
mkdir -p "$DIR"

if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
  echo "[kalaa mongo] already running on port $PORT. Nothing to do."
  exit 0
fi
echo "[kalaa mongo] starting on port $PORT (log: $DIR/mongod.log). Ctrl+C to stop."

# First start only: initiate the replica set once the server is accepting connections.
if [ ! -f "$DIR/.initiated" ]; then
  (
    for _ in $(seq 1 40); do
      if node -e "
        const {MongoClient}=require('mongodb');
        (async()=>{const c=new MongoClient('mongodb://127.0.0.1:$PORT/?directConnection=true',{serverSelectionTimeoutMS:500});
        try{await c.connect();try{await c.db('admin').command({replSetInitiate:{_id:'rs0',members:[{_id:0,host:'127.0.0.1:$PORT'}]}})}catch(e){if(e.codeName!=='AlreadyInitialized')throw e}
        process.exit(0)}catch{process.exit(1)}})()" 2>/dev/null; then touch "$DIR/.initiated"; echo "[kalaa mongo] replica set initiated"; break; fi
      sleep 0.5
    done
  ) &
fi

exec "$MONGOD" --dbpath "$DIR" --port "$PORT" --bind_ip 127.0.0.1 --replSet rs0 --logpath "$DIR/mongod.log" --logappend
