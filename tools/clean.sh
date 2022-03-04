#!/bin/sh
# Copyright (c) 2022 Google LLC All rights reserved.
# Use of this source code is governed by a BSD-style
# license that can be found in the LICENSE file.

echo ':: npx tsc --build --clean'
npx tsc --build --clean
echo ':: done.'