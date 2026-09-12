#!/usr/bin/env bash
set -uo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
out="$root/assets/images"
log="$root/assets/download-report.txt"
mkdir -p "$out"
: > "$log"

fetch() {
  local file="$1"
  local url="$2"
  local temp
  temp="$(mktemp "$out/.${file}.XXXXXX")"
  printf 'Downloading %s\n' "$file" | tee -a "$log"
  if curl --location --fail --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 180 \
    --user-agent 'HistoricalLearningAssetCollector/1.0' --output "$temp" "$url"; then
    local kind
    kind="$(file -b "$temp")"
    if [[ "$kind" == *"HTML document"* || "$kind" == *"JSON text"* || "$kind" == *"ASCII text"* ]]; then
      printf 'FAILED %s: downloaded non-image payload (%s)\n' "$file" "$kind" | tee -a "$log"
      rm -f "$temp"
      return 1
    fi
    mv "$temp" "$out/$file"
    printf 'OK %s: %s\n' "$file" "$kind" | tee -a "$log"
  else
    printf 'FAILED %s: curl failure\n' "$file" | tee -a "$log"
    rm -f "$temp"
    return 1
  fi
}

status=0
fetch '01-apollo-aldrin-near-eagle.jpg' 'https://catalog.archives.gov/medialive/40/6851/16685140/content/arcmedia/stillpix/255-amp/Apollo_11/as11-40-5903_alt.jpg' || status=1
fetch '02-apollo-aldrin-full-frame.jpg' 'https://upload.wikimedia.org/wikipedia/commons/1/14/AS11-40-5903_-_Buzz_Aldrin_by_Neil_Armstrong_%28full_frame%29.jpg' || status=1
fetch '03-apollo-lm-surface.jpg' 'https://images-assets.nasa.gov/image/as11-40-5915/as11-40-5915~large.jpg' || status=1
fetch '04-berlin-potsdamer-platz-opening.jpeg' 'https://catalog.archives.gov/medialive/15/4601/6460115/content/arcmedia/stillpix/330-cfd/1991/DF-ST-91-01380.jpeg' || status=1
fetch '05-berlin-people-walking.jpg' 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Fall_of_the_Berlin_Wall_1989%2C_people_walking.jpg' || status=1
fetch '06-berlin-checkpoint-charlie.jpg' 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Bundesarchiv_Bild_183-1989-1110-018%2C_Berlin%2C_Checkpoint_Charlie%2C_Nacht_des_Mauerfalls.jpg' || status=1
fetch '07-dday-into-the-jaws.jpg' 'https://upload.wikimedia.org/wikipedia/commons/d/dc/D-day_Normandy_Nara_26-G-2343.jpg' || status=1
fetch '08-dday-eisenhower-paratroopers.jpg' 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Eisenhower_d-day.jpg' || status=1
fetch '09-dday-approaching-omaha.jpg' 'https://upload.wikimedia.org/wikipedia/commons/9/96/Approaching_Omaha.jpg' || status=1
fetch '10-march-leadership-procession.jpg' 'https://upload.wikimedia.org/wikipedia/commons/c/c3/1963_march_on_washington.jpg' || status=1
fetch '12-march-reflecting-pool-crowd.jpg' 'https://upload.wikimedia.org/wikipedia/commons/3/3d/View_of_Crowd_at_1963_March_on_Washington.jpg' || status=1
fetch '13-partition-gandhi-suhrawardy.jpg' 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Gandhi_and_Suhrawardy_fasting_15_August_1947_in_Calcutta_2.jpg' || status=1
fetch '14-armistice-nyc-celebration.jpg' 'https://commons.wikimedia.org/wiki/Special:FilePath/Armistice_-_Armistice_-_Armistice_celebration_in_New_York_City_on_Nov._11%2C_1918_-_NARA_-_20807050.jpg' || status=1
fetch '15-armistice-train.jpg' 'https://upload.wikimedia.org/wikipedia/commons/2/21/Armisticetrain.jpg' || status=1
fetch '16-armistice-london-crowd.jpg' 'https://upload.wikimedia.org/wikipedia/commons/7/74/Armistice_Day_in_London%2C_11_November_1918_Q47852.jpg' || status=1
fetch '17-sf-devastation.gif' 'https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/thumbnails/image/1906%20san%20francisco%20eq.gif' || status=1
fetch '18-sf-city-hall-ruin.jpg' 'https://catalog.archives.gov/medialive/83/1272/2127283/content/arcmedia/nwl/gal/earthquake_06_a.jpg' || status=1
fetch '19-sf-golden-gate-relief-camp.jpg' 'https://catalog.archives.gov/medialive/11/1273/2127311/content/arcmedia/nwl/gal/earthquake_46_a.jpg' || status=1
fetch '20-triangle-fire-exterior.jpg' 'https://upload.wikimedia.org/wikipedia/commons/8/87/Image_of_Triangle_Shirtwaist_Factory_fire_on_March_25_-_1911.jpg' || status=1
fetch '21-triangle-mourning-demonstration.jpg' 'https://catalog.archives.gov/medialz/rediscovery/11719_2005_001_a.jpg' || status=1
fetch '23-bandung-economic-plenary.jpg' 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Delegations_held_a_Plenary_Meeting_of_the_Economic_Section_during_the_A-A_Conference_in_Merdeka_Building%2C_Bandung%2C_on_April_20th_1955.jpg' || status=1
fetch '24-bandung-soekarno-opening.jpg' 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Soekarno_at_KAA.jpg' || status=1
fetch '25-bandung-savoy-homann-dinner.jpg' 'https://upload.wikimedia.org/wikipedia/commons/2/21/Gala_Dinner_for_the_Asian-African_Conference_in_Savoy_Homann_Hotel%2C_Bandung%2C_on_April_19th_1955.jpg' || status=1
fetch '26-windrush-vessel-profile.jpg' 'https://upload.wikimedia.org/wikipedia/commons/1/15/HMT_Empire_Windrush_FL9448.jpg' || status=1
fetch '27-windrush-passenger-list-header.jpg' 'https://upload.wikimedia.org/wikipedia/commons/5/58/Passenger_list_header_M.V._%22Empire_Windrush%22%2C_Tilbury_June_1948.jpg' || status=1
fetch '28-windrush-monte-rosa.jpg' 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Monte-rosa-in-copenhagen.jpg' || status=1

printf '\n--- SHA-256 ---\n' | tee -a "$log"
if command -v shasum >/dev/null 2>&1; then
  find "$out" -maxdepth 1 -type f | sort | while IFS= read -r path; do
    shasum -a 256 "$path" | tee -a "$log"
  done
else
  find "$out" -maxdepth 1 -type f -printf '%f\n' | sort | while IFS= read -r name; do
    sha256sum "$out/$name" | tee -a "$log"
  done
fi

exit "$status"
