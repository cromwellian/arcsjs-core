/**
 * Copyright (c) 2022 Google LLC All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

import {Store, StoreMeta} from './Store.js';
import {debounce} from '../utils/task.js';
import {matches} from '../recipe/StoreCook.js';
// TODO(sjmiles): layer violation: promote this module out of core/
import {Runtime} from '../Runtime.js';

export class AggregateStore extends Store {
  criteria;
  stores;
  protected debounceKey;
  constructor(meta: StoreMeta) {
    super(meta);
    this._data = [];
    this.stores = [];
    this.criteria = {name: this.nameFromTags(), type: meta.type};
  }
  nameFromTags() {
    // The aggregate store meta will contain `name:storeName` tag.
    return this.tags.map(t => (t.match(/^name:(.*)$/) || [])[1]).filter(t => t)[0];
  }
  onContextAdd(store) {
    this.addMapped([store]);
  }
  onContextChanged(store) {
    if (this.hasStore(store)) {
      this.invalidateStore();
    }
  }
  addMapped(stores) {
    const matching = store => matches(store.meta, this.criteria);
    const matchingStores = stores?.filter(matching);
    if (matchingStores?.length > 0) {
      this.pushStores(matchingStores);
      this.invalidateStore();
    }
  }
  protected pushStores(stores) {
    const newStores = stores.filter(store => !this.hasStore(store));
    if (newStores.length > 0) {
      this.stores.push(...newStores);
    }
  }
  protected invalidateStore() {
    this.debounceKey = debounce(this.debounceKey, () => this.aggregateStores(), 40);
  }
  protected async aggregateStores() {
    this.debounceKey = null;
    const aggregate = this.stores
      .map((store: Store) => store?.data)
      .filter(data => data && Array.isArray(data))
      .flat()
      ;
    this.change(doc => doc.data = aggregate);
  }
  // TODO(mariakleiner): figure out save/load
  save() {
    //return this.stores.map(({meta}) => meta);
  }
  hasStore(store) {
    return this.stores.some(({meta}) => meta.name === store.meta.name);
  }
  // TODO(sjmiles): try to roll this stuff into persistor logic
  marshal(runtime: Runtime) {
    this.addMapped(Object.values(this.stores));
    runtime.listen('store-added', s => this.onContextAdd(s));
    runtime.listen('store-changed', s => this.onContextChanged(s));
    // TODO(sjmiles): I think 'restore' is the wrong name, since we use that for persistence
    this.rebuild(runtime);
  }
  rebuild(runtime: Runtime) {
    // TODO(sjmiles): why store.meta.value?
    const metas = this.meta?.value;
    // turn metas into Stores
    const stores = metas.map(meta => runtime.requireStore(meta));
    this.addMapped(stores);
  }
}

Runtime.registerStoreClass('aggregate', AggregateStore);