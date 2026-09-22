#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/compose.yml"
ENV_FILE="${PRINTCLUB_ENV_FILE:-$ROOT_DIR/deploy/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
	printf 'Missing deployment environment file: %s\nCopy deploy/.env.example to deploy/.env and fill every value.\n' "$ENV_FILE" >&2
	exit 1
fi

compose() {
	docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "Building printclub images..."
compose build api web

echo "Starting the private database..."
compose up -d postgres

echo "Applying reviewed database migrations..."
# The migration service has its own Docker build target. Force a rebuild so a
# newly pulled migration file is never skipped by a cached image.
compose run --rm --build migrate

echo "Starting the API and web services..."
compose up -d api web

echo "Waiting for health checks..."
for service in api web; do
	container="$(compose ps -q "$service")"
	for attempt in $(seq 1 30); do
		status="$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo starting)"
		if [[ "$status" == "healthy" ]]; then
			echo "$service is healthy."
			break
		fi
		if [[ "$status" == "unhealthy" || "$attempt" == 30 ]]; then
			compose logs --tail 80 "$service"
			exit 1
		fi
		sleep 2
	done
done

echo "printclub is deployed behind Traefik."
