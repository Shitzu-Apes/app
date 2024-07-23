#!/bin/sh

remove_if_directory_exists() {
	if [ -d "$1" ]; then rm -Rf "$1"; fi
}

submodule="./charting_library"

remove_if_directory_exists "static/charting_library"
remove_if_directory_exists "src/lib/datafeeds"
remove_if_directory_exists "src/lib/charting_library"

cp -r "$submodule/charting_library" static
cp -r "$submodule/datafeeds" src/lib
cp -r "$submodule/charting_library" src/lib