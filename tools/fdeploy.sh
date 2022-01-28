#!/bin/sh
# Copyright (c) 2022 Google LLC All rights reserved.
# Use of this source code is governed by a BSD-style
# license that can be found in the LICENSE file or at
# https://developers.google.com/open-source/licenses/bsd

./tools/build.sh

echo '#### deploy'
firebase deploy --only hosting
