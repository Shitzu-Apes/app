#!/bin/bash
set -e
cd "`dirname $0`"

rm -rf abi-gen
mkdir -p abi-gen

readarray -t keys < <(jq -c '.body.root_schema.definitions' abi/contract_abi.json | jq 'keys' | jq '.[]')

for key in "${keys[@]}"; do
    key=$(echo $key | sed 's/"//g')
    jq -c '.body.root_schema.definitions.'$key abi/contract_abi.json >> abi-gen/$key.json
    sed -E -i 's|"#\/definitions\/([a-zA-Z0-9]*)"|"\1\.json"|g' abi-gen/$key.json
done

for key in "${keys[@]}"; do
    key=$(echo $key | sed 's/"//g')
    # if [[ "$key" == "BetView" ]]; then
    #     continue
    # fi
    set +e
    yarn json2ts --cwd=abi-gen abi-gen/$key.json abi-gen/$key.d.ts
    if [ $? -eq 0 ]; then
        echo "export * from './$key';" >> abi-gen/index.ts
    fi
    set -e
done

yarn tsup abi-gen/index.ts --dts-only -d src/lib/abi --format esm
sed -E -i 's|\[k: string\]: unknown;||g' src/lib/abi/index.d.ts
yarn prettier --write src/lib/abi
rm -rf abi-gen
