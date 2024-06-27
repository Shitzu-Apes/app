#!/bin/sh

remove_if_directory_exists() {
	if [ -d "$1" ]; then rm -Rf "$1"; fi
}

BRANCH="master";

REPOSITORY="${CHARTING_LIBRARY_REPOSITORY}"

LATEST_HASH=$(git ls-remote $REPOSITORY $BRANCH | grep -Eo '^[[:alnum:]]+')

remove_if_directory_exists "$LATEST_HASH"

git clone -q --depth 1 -b "$BRANCH" $REPOSITORY "$LATEST_HASH"

remove_if_directory_exists "static/charting_library"
remove_if_directory_exists "src/lib/datafeeds"
remove_if_directory_exists "src/lib/charting_library"

cp -r "$LATEST_HASH/charting_library" static
cp -r "$LATEST_HASH/datafeeds" src/lib
cp -r "$LATEST_HASH/charting_library" src/lib

remove_if_directory_exists "$LATEST_HASH"