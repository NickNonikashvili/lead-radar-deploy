#!/bin/sh
# Lists frames of a clip that are (almost) blank: a page between loads.
cd "$(dirname "$0")/clips/$1" && identify -format "%f %[fx:standard_deviation]\n" f*.jpg 2>/dev/null | awk '$2 < 0.04 { print $1 }'
