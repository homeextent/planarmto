#!/usr/bin/env bash
set -euo pipefail
# Disposable CI-only WordPress and MariaDB; never accepts an external endpoint.
project="planarmto-ci-${GITHUB_RUN_ID:-$$}"
network="$project"
db="$project-db"
wp="$project-wp"
cli_image=wordpress:cli-php8.3
wp_image=wordpress:php8.3-apache
cleanup() {
  docker rm -f -v "$wp" "$db" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create "$network" >/dev/null
docker run -d --name "$db" --network "$network" \
  -e MARIADB_ROOT_PASSWORD=ci-root-only -e MARIADB_DATABASE=wordpress \
  -e MARIADB_USER=wordpress -e MARIADB_PASSWORD=ci-db-only mariadb:11.4 >/dev/null
for i in $(seq 1 60); do
  if docker exec "$db" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$db" healthcheck.sh --connect --innodb_initialized >/dev/null
docker run -d --name "$wp" --network "$network" -p 127.0.0.1:18080:80 \
  -e WORDPRESS_DB_HOST="$db" -e WORDPRESS_DB_NAME=wordpress \
  -e WORDPRESS_DB_USER=wordpress -e WORDPRESS_DB_PASSWORD=ci-db-only "$wp_image" >/dev/null
base=http://127.0.0.1:18080
for i in $(seq 1 60); do
  if curl -fsS "$base/wp-admin/install.php" >/dev/null; then break; fi
  sleep 2
done
curl -fsS "$base/wp-admin/install.php" >/dev/null
wpcli() {
  docker run --rm --network "$network" --volumes-from "$wp" \
    -e WORDPRESS_DB_HOST="$db" -e WORDPRESS_DB_NAME=wordpress \
    -e WORDPRESS_DB_USER=wordpress -e WORDPRESS_DB_PASSWORD=ci-db-only \
    "${cli_image}" wp "$@"
}
echo 'Initializing disposable WordPress via WP-CLI'
wpcli core install --url="$base" --title=PlanarMTO-CI --admin_user=ciadmin \
  --admin_password=ci-admin-only-123 --admin_email=ci@example.invalid --skip-email
docker exec "$wp" mkdir -p /var/www/html/wp-content/plugins/planarmto
docker cp planar-mto.php "$wp:/var/www/html/wp-content/plugins/planarmto/"
docker cp dist "$wp:/var/www/html/wp-content/plugins/planarmto/"
wpcli plugin activate planarmto
wpcli rewrite structure '/%postname%/'
# Actual WordPress cookie authentication and REST nonce, not a mocked response.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"; cleanup' EXIT
curl -fsS -c "$tmp/cookies" "$base/wp-login.php" >/dev/null
curl -fsS -L -b "$tmp/cookies" -c "$tmp/cookies" \
  --data-urlencode log=ciadmin --data-urlencode pwd=ci-admin-only-123 \
  --data-urlencode "redirect_to=$base/wp-admin/" --data testcookie=1 \
  "$base/wp-login.php" >/dev/null
curl -fsS -b "$tmp/cookies" "$base/?planarmto_route=1" > "$tmp/app.html"
nonce=$(python3 -c 'import re,sys; print(re.search("nonce: "+chr(34)+"([^"+chr(34)+"]+)"+chr(34),open(sys.argv[1]).read()).group(1))' "$tmp/app.html")
grep -Eq 'currentUserId: [1-9][0-9]*' "$tmp/app.html"
grep -F "$base/wp-content/plugins/planarmto/dist/assets/" "$tmp/app.html" >/dev/null
worker=$(find dist/assets -type f -name 'pdf.worker*.js' -print -quit)
test -n "$worker"
curl -fsS -D "$tmp/headers" "$base/wp-content/plugins/planarmto/$worker" -o "$tmp/worker"
grep -Ei '^content-type: (application|text)/(javascript|ecmascript)' "$tmp/headers"
cmp "$worker" "$tmp/worker"
# Guest app loads, but anonymous REST persistence must be rejected.
curl -fsS -b 'planarmto_guest_access=1' "$base/?planarmto_route=1" > "$tmp/guest.html"
grep -F 'currentUserId: 0' "$tmp/guest.html" >/dev/null
rest="$base/?rest_route=/planarmto/v1/projects"
code=$(curl -sS -o "$tmp/anonymous.json" -w '%{http_code}' "$rest")
test "$code" = 401 || test "$code" = 403
# Realistic size, deterministic synthetic raster bytes; no real client documents.
python3 - "$tmp/project.json" <<'PY'
import json,sys,base64,random
src='data:image/png;base64,'+base64.b64encode(random.Random(42).randbytes(600000)).decode()
state={'nodes':[],'walls':[],'settings':{'unitSystem':'imperial','theme':'blueprint','gridSnap':True},'underlay':{'src':src,'worldX':7,'worldY':-3,'feetPerPixel':0.0125,'opacity':0.5,'isLocked':True,'isVisible':True,'pdfSource':{'filename':'synthetic.pdf','page':2,'width':5000,'height':3235}}}
json.dump({'id':'ci-pdf','name':'Synthetic PDF','state':state},open(sys.argv[1],'w'))
PY
post() {
  curl -sS -b "$tmp/cookies" -H "X-WP-Nonce: $nonce" -H 'Content-Type: application/json' \
    --data-binary @"$1" -o "$2" -w '%{http_code}' "$rest"
}
test "$(post "$tmp/project.json" "$tmp/save.json")" = 200
python3 -c 'import json,sys; assert json.load(open(sys.argv[1]))["success"] is True' "$tmp/save.json"
curl -fsS -b "$tmp/cookies" -H "X-WP-Nonce: $nonce" "$rest" > "$tmp/projects.json"
python3 - "$tmp/project.json" "$tmp/projects.json" <<'PY'
import json,sys
expected=json.load(open(sys.argv[1]))
rows=json.load(open(sys.argv[2]))
assert len(rows)==1
assert rows[0]['id']==expected['id']
actual=rows[0]['state']
for key,value in expected['state'].items():
    assert key in actual, f'Missing project state field: {key}'
    assert actual[key]==value, f'Project state mismatch in field: {key}'
assert actual.keys()==expected['state'].keys(), 'Unexpected project state fields'
print('Project state round trip verified.')
PY
# Force a real database write error by renaming the disposable table.
docker exec "$db" mariadb -uwordpress -pci-db-only wordpress -e 'RENAME TABLE wp_planarmto_projects TO wp_planarmto_projects_disabled'
test "$(post "$tmp/project.json" "$tmp/failure.json")" = 500
python3 -c 'import json,sys; assert json.load(open(sys.argv[1]))["code"]=="planarmto_save_failed"' "$tmp/failure.json"
docker exec "$db" mariadb -uwordpress -pci-db-only wordpress -e 'RENAME TABLE wp_planarmto_projects_disabled TO wp_planarmto_projects'
echo 'WordPress REST persistence, database failure, guest isolation and worker delivery passed.'
