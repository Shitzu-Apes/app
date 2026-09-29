#!/bin/sh

remove_if_directory_exists() {
	if [ -d "$1" ]; then rm -Rf "$1"; fi
}

submodule="./charting_library"

remove_if_directory_exists "packages/static/charting_library"
remove_if_directory_exists "packages/lib/src/datafeeds"
remove_if_directory_exists "packages/lib/src/charting_library"

cp -r "$submodule/charting_library" packages/static
cp -r "$submodule/datafeeds" packages/lib/src
cp -r "$submodule/charting_library" packages/lib/src