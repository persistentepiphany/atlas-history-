#!/usr/bin/env bash
# Re-fetches the archival image library described in ASSET_MANIFEST.md into assets/images/,
# writes a per-file result log plus SHA-256 digests, and exits non-zero if anything failed.
# No -e: one dead host should be reported against its own file, not abort the whole run.
set -uo pipefail

repo_root="$(cd "$(dirname "$0")" && pwd)"
image_dir="$repo_root/assets/images"
report_path="$repo_root/assets/download-report.txt"

# "filename url" pairs. The gaps at 11 and 22 are the source-only rows in ASSET_MANIFEST.md:
# the Library of Congress image host answers 403 here, so those stay as source records.
images=(
  "01-apollo-aldrin-near-eagle.jpg https://catalog.archives.gov/medialive/40/6851/16685140/content/arcmedia/stillpix/255-amp/Apollo_11/as11-40-5903_alt.jpg"
  "02-apollo-aldrin-full-frame.jpg https://upload.wikimedia.org/wikipedia/commons/1/14/AS11-40-5903_-_Buzz_Aldrin_by_Neil_Armstrong_%28full_frame%29.jpg"
  "03-apollo-lm-surface.jpg https://images-assets.nasa.gov/image/as11-40-5915/as11-40-5915~large.jpg"
  "04-berlin-potsdamer-platz-opening.jpeg https://catalog.archives.gov/medialive/15/4601/6460115/content/arcmedia/stillpix/330-cfd/1991/DF-ST-91-01380.jpeg"
  "05-berlin-people-walking.jpg https://upload.wikimedia.org/wikipedia/commons/4/4c/Fall_of_the_Berlin_Wall_1989%2C_people_walking.jpg"
  "06-berlin-checkpoint-charlie.jpg https://upload.wikimedia.org/wikipedia/commons/d/d7/Bundesarchiv_Bild_183-1989-1110-018%2C_Berlin%2C_Checkpoint_Charlie%2C_Nacht_des_Mauerfalls.jpg"
  "07-dday-into-the-jaws.jpg https://upload.wikimedia.org/wikipedia/commons/d/dc/D-day_Normandy_Nara_26-G-2343.jpg"
  "08-dday-eisenhower-paratroopers.jpg https://upload.wikimedia.org/wikipedia/commons/d/d6/Eisenhower_d-day.jpg"
  "09-dday-approaching-omaha.jpg https://upload.wikimedia.org/wikipedia/commons/9/96/Approaching_Omaha.jpg"
  "10-march-leadership-procession.jpg https://upload.wikimedia.org/wikipedia/commons/c/c3/1963_march_on_washington.jpg"
  "12-march-reflecting-pool-crowd.jpg https://upload.wikimedia.org/wikipedia/commons/3/3d/View_of_Crowd_at_1963_March_on_Washington.jpg"
  "13-partition-gandhi-suhrawardy.jpg https://upload.wikimedia.org/wikipedia/commons/6/6b/Gandhi_and_Suhrawardy_fasting_15_August_1947_in_Calcutta_2.jpg"
  "14-armistice-nyc-celebration.jpg https://commons.wikimedia.org/wiki/Special:FilePath/Armistice_-_Armistice_-_Armistice_celebration_in_New_York_City_on_Nov._11%2C_1918_-_NARA_-_20807050.jpg"
  "15-armistice-train.jpg https://upload.wikimedia.org/wikipedia/commons/2/21/Armisticetrain.jpg"
  "16-armistice-london-crowd.jpg https://upload.wikimedia.org/wikipedia/commons/7/74/Armistice_Day_in_London%2C_11_November_1918_Q47852.jpg"
  "17-sf-devastation.gif https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/thumbnails/image/1906%20san%20francisco%20eq.gif"
  "18-sf-city-hall-ruin.jpg https://catalog.archives.gov/medialive/83/1272/2127283/content/arcmedia/nwl/gal/earthquake_06_a.jpg"
  "19-sf-golden-gate-relief-camp.jpg https://catalog.archives.gov/medialive/11/1273/2127311/content/arcmedia/nwl/gal/earthquake_46_a.jpg"
  "20-triangle-fire-exterior.jpg https://upload.wikimedia.org/wikipedia/commons/8/87/Image_of_Triangle_Shirtwaist_Factory_fire_on_March_25_-_1911.jpg"
  "21-triangle-mourning-demonstration.jpg https://catalog.archives.gov/medialz/rediscovery/11719_2005_001_a.jpg"
  "23-bandung-economic-plenary.jpg https://upload.wikimedia.org/wikipedia/commons/e/ec/Delegations_held_a_Plenary_Meeting_of_the_Economic_Section_during_the_A-A_Conference_in_Merdeka_Building%2C_Bandung%2C_on_April_20th_1955.jpg"
  "24-bandung-soekarno-opening.jpg https://upload.wikimedia.org/wikipedia/commons/e/e7/Soekarno_at_KAA.jpg"
  "25-bandung-savoy-homann-dinner.jpg https://upload.wikimedia.org/wikipedia/commons/2/21/Gala_Dinner_for_the_Asian-African_Conference_in_Savoy_Homann_Hotel%2C_Bandung%2C_on_April_19th_1955.jpg"
  "26-windrush-vessel-profile.jpg https://upload.wikimedia.org/wikipedia/commons/1/15/HMT_Empire_Windrush_FL9448.jpg"
  "27-windrush-passenger-list-header.jpg https://upload.wikimedia.org/wikipedia/commons/5/58/Passenger_list_header_M.V._%22Empire_Windrush%22%2C_Tilbury_June_1948.jpg"
  "28-windrush-monte-rosa.jpg https://upload.wikimedia.org/wikipedia/commons/4/4b/Monte-rosa-in-copenhagen.jpg"
)

report() {
  printf '%s\n' "$1" | tee -a "$report_path"
}

fetch_image() {
  local file_name="$1"
  local url="$2"
  local temp_path
  temp_path="$(mktemp "$image_dir/.partial-XXXXXX")"
  report "Downloading $file_name"
  # No --retry-delay: it would override the Retry-After that a 429 response carries.
  if ! curl --location --fail --retry 4 --connect-timeout 20 --max-time 300 \
    --user-agent "$user_agent" --output "$temp_path" "$url"; then
    report "FAILED $file_name: curl failure"
    rm -f "$temp_path"
    return 1
  fi
  # Several archive hosts answer 200 with an HTML denial or error page, so trust the
  # sniffed content rather than the status code before overwriting a known-good file.
  local file_type
  file_type="$(file -b "$temp_path")"
  if [[ "$file_type" == *"HTML document"* || "$file_type" == *"JSON text"* || "$file_type" == *"ASCII text"* ]]; then
    report "FAILED $file_name: downloaded non-image payload ($file_type)"
    rm -f "$temp_path"
    return 1
  fi
  mv "$temp_path" "$image_dir/$file_name"
  report "OK $file_name: $file_type"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 2
  fi
}

require_command curl
require_command file

# macOS ships shasum, most Linux images ship sha256sum; pick one up front.
digest_command=(shasum -a 256)
if ! command -v shasum >/dev/null 2>&1; then
  require_command sha256sum
  digest_command=(sha256sum)
fi

# Wikimedia throttles a client whose User-Agent carries no contact details to roughly 10
# requests a minute and answers 429 past that, so an unidentified run of this size cannot
# finish (checked 12 September 2026: Wikimedia Foundation User-Agent policy and the
# Wikimedia APIs/Rate limits page). Set ASSET_FETCH_CONTACT to a URL or address you control.
user_agent='HistoricalLearningAssetCollector/1.0'
if [[ -n "${ASSET_FETCH_CONTACT:-}" ]]; then
  user_agent="$user_agent ($ASSET_FETCH_CONTACT)"
else
  printf 'ASSET_FETCH_CONTACT is unset: Wikimedia rows will be throttled to about 10 per minute.\n' >&2
fi

# Sequential with a gap, as the Wikimedia robot policy asks for on upload.wikimedia.org.
# Pacing alone is not enough: an unidentified run still hit 429 partway down the list when
# this was measured on 12 September 2026. The contact-bearing User-Agent is the real fix.
fetch_interval_seconds=7

mkdir -p "$image_dir"
: > "$report_path"
# mktemp leaves a partial file behind if the run is interrupted mid-download.
trap 'rm -f "$image_dir"/.partial-*' EXIT

exit_status=0
for entry in "${images[@]}"; do
  read -r file_name url <<<"$entry"
  fetch_image "$file_name" "$url" || exit_status=1
  sleep "$fetch_interval_seconds"
done

report ""
report "--- SHA-256 ---"
# Digest paths stay repo-relative so two machines' reports can be diffed directly.
(
  cd "$repo_root" || exit 1
  find assets/images -maxdepth 1 -type f -name '[0-9]*' | sort | while IFS= read -r path; do
    "${digest_command[@]}" "$path"
  done
) | tee -a "$report_path"

exit "$exit_status"
