/**
 * Copyright (c) 2022 Google LLC All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

import {Paths} from '../utils/paths.js';
import {logFactory} from '../utils/log.js';

const log = logFactory(logFactory.flags.code, 'code', 'gold');

const defaultParticleBasePath = '$arcs/js/core/Particle.js';

export const requireParticleImplCode = async (kind, options?) => {
  const code = options?.code || await fetchParticleCode(kind);
  // TODO(sjmiles): brittle content processing, needs to be documented
  return code.slice(code.indexOf('('));
};

export const requireParticleBaseCode = async (sourcePath?) => {
  if (!requireParticleBaseCode.source) {
    const path = Paths.resolve(sourcePath || defaultParticleBasePath);
    log('particle base code path: ', path);
    const response = await fetch(path);
    const moduleText = await response.text();
    requireParticleBaseCode.source = moduleText.replace(/export /g, '');
  }
  return requireParticleBaseCode.source;
};
requireParticleBaseCode.source = null;

export const fetchParticleCode = async (kind?) => {
  let text;
  if (kind) {
    const path = pathForKind(Paths.resolve(kind));
    text = await maybeFetchParticleCode(path);
    if (!text) {
      log.error(`could not locate implementation for particle "${kind}" [${path}]`);
    }
  } else {
    log.error(`fetchParticleCode: empty 'kind'`);
  }
  return text;
};

export const pathForKind = (kind?) => {
  if (kind) {
    if (!'$./'.includes(kind[0]) && !kind.includes('://')) {
      kind = `$library/${kind}`;
    }
    if (!kind?.split('/').pop().includes('.')) {
      kind = `${kind}.js`;
    }
    return Paths.resolve(kind);
  }
  return '404';
};

export const maybeFetchParticleCode = async (path) => {
  try {
    const response = await fetch(path);
    if (response.ok) {
      return await response.text();
    }
  } catch(x) {
    /**/
  }
};
