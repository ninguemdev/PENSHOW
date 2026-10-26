#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Run the validated local bundle via sudo in the VM's Session Manager terminal.
[[ "$(id -u)" == 0 ]] || { echo 'Execute com sudo.' >&2; exit 1; }
release_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
penshow_dir=/opt/penshow
comicle_dir=/opt/comicle
[[ -f "$release_dir/image.tar" && -f "$comicle_dir/Caddyfile" ]] || {
  echo 'Bundle incompleto ou instalação Comicle diferente de /opt/comicle.' >&2; exit 1;
}
command -v docker >/dev/null
command -v curl >/dev/null
docker compose version >/dev/null
mapfile -t caddy_ids < <(docker ps --quiet --filter label=com.docker.compose.project=comicle --filter label=com.docker.compose.service=caddy)
[[ "${#caddy_ids[@]}" == 1 ]] || { echo 'Esperado um único Caddy do Comicle em execução.' >&2; exit 1; }
caddy_id="${caddy_ids[0]}"
origin_host="$(docker exec "$caddy_id" sh -c 'printf "%s" "$ORIGIN_HOST"')"
[[ "$origin_host" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || { echo 'ORIGIN_HOST inválido.' >&2; exit 1; }
origin_url="https://$origin_host"
check_comicle() {
  curl --fail --silent --show-error --insecure --max-time 15 \
    --resolve "$origin_host:443:127.0.0.1" "$origin_url/comicle/" --output /dev/null
}
check_comicle
mapfile -t comicle_ids < <(docker ps --quiet --filter label=com.docker.compose.project=comicle --filter label=com.docker.compose.service=app)
[[ "${#comicle_ids[@]}" == 1 ]] || { echo 'App Comicle não identificado.' >&2; exit 1; }
comicle_before="$(docker inspect --format '{{.Id}} {{.State.StartedAt}}' "${comicle_ids[0]}")"

install -d -m 0750 "$penshow_dir"
backup_dir="$(mktemp -d "$penshow_dir/backup-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
cp --preserve=mode,ownership,timestamps "$comicle_dir/Caddyfile" "$backup_dir/Caddyfile.original"
original_hash="$(sha256sum "$comicle_dir/Caddyfile" | cut -d ' ' -f 1)"
if [[ -f "$penshow_dir/compose.yaml" ]]; then cp "$penshow_dir/compose.yaml" "$backup_dir/penshow-compose.yaml"; fi
if [[ ! -f "$penshow_dir/.env" ]]; then install -m 0600 "$release_dir/.env.example" "$penshow_dir/.env"; fi
install -m 0640 "$release_dir/compose.yaml" "$penshow_dir/compose.yaml"
compose=(docker compose --project-name penshow --env-file "$penshow_dir/.env" --file "$penshow_dir/compose.yaml")
"${compose[@]}" config --quiet
network="$(sed -n 's/^COMICLE_NETWORK=//p' "$penshow_dir/.env")"
[[ "$network" =~ ^[a-zA-Z0-9_.-]+$ ]] || { echo 'COMICLE_NETWORK deve ser o nome literal da rede existente.' >&2; exit 1; }
docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$caddy_id" | grep --fixed-strings --line-regexp -- "$network" >/dev/null
expected_image="$(sed -n 's/^PENSHOW_IMAGE=//p' "$release_dir/.env.example")"
[[ "$("${compose[@]}" config --images)" == "$expected_image" ]] || {
  echo 'A imagem de /opt/penshow/.env difere da imagem validada neste bundle.' >&2; exit 1;
}
docker image load --input "$release_dir/image.tar" >"$backup_dir/image-load.log"

# Generate a candidate; do not overwrite the bind-mounted live Caddyfile during preparation.
docker run --rm --network none --read-only --user 0 --entrypoint node \
  --mount "type=bind,source=$comicle_dir/Caddyfile,target=/existing/Caddyfile,readonly" \
  --mount "type=bind,source=$release_dir/ops,target=/ops,readonly" \
  --mount "type=bind,source=$backup_dir,target=/out" \
  "$expected_image" /ops/prepare-comicle-caddy.mjs /existing/Caddyfile /out/Caddyfile.candidate
"${compose[@]}" up --detach --no-build --pull never --wait --wait-timeout 60 penshow

candidate_path="/tmp/penshow-$(basename "$backup_dir").Caddyfile"
docker cp "$backup_dir/Caddyfile.candidate" "$caddy_id:$candidate_path" >/dev/null
docker exec "$caddy_id" caddy validate --config "$candidate_path" --adapter caddyfile
[[ "$(sha256sum "$comicle_dir/Caddyfile" | cut -d ' ' -f 1)" == "$original_hash" ]] || {
  echo 'O Caddyfile mudou durante a instalação; candidato não aplicado.' >&2; exit 1;
}
rollback_proxy() {
  trap - ERR
  # Preserve the existing bind mount inode; replacing the file via rename would leave old content mounted.
  cat "$backup_dir/Caddyfile.original" >"$comicle_dir/Caddyfile"
  docker exec "$caddy_id" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
  echo "Proxy restaurado. Evidências em $backup_dir; o Comicle não foi reiniciado." >&2
}
trap rollback_proxy ERR
cat "$backup_dir/Caddyfile.candidate" >"$comicle_dir/Caddyfile"
docker exec "$caddy_id" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
check_comicle
curl --fail --silent --show-error --insecure --max-time 15 \
  --resolve "$origin_host:443:127.0.0.1" "$origin_url/penshow/api/health" --output "$backup_dir/penshow-health.json"
docker run --rm --network none --read-only --user 0 --entrypoint node \
  --mount "type=bind,source=$backup_dir,target=/checks,readonly" "$expected_image" \
  --input-type=module -e 'import assert from "node:assert/strict"; import {readFile} from "node:fs/promises"; assert.deepEqual(JSON.parse(await readFile("/checks/penshow-health.json","utf8")), {service:"penshow",status:"ok"});'
curl --fail --silent --show-error --insecure --max-time 15 \
  --resolve "$origin_host:443:127.0.0.1" "$origin_url/penshow/" --output /dev/null
[[ "$(docker inspect --format '{{.Id}} {{.State.StartedAt}}' "${comicle_ids[0]}")" == "$comicle_before" ]]
trap - ERR
docker exec "$caddy_id" rm -f -- "$candidate_path"
echo "PENSHOW instalado na origem; Comicle preservado. Backup: $backup_dir"
echo 'Ative apenas as rotas Cloudflare /penshow e /penshow/* e confira o acesso público.'
