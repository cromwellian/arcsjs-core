/**
 * @license
 * Copyright 2020 Google LLC.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {EventEmitter} from './EventEmitter.js';
import {Host} from './Host.js';
import {logFactory} from '../utils/log.js';

//type Dictionary<T> = {[name: string]: T};

const customLogFactory = (id: string) => logFactory(logFactory.flags.arc, `Arc (${id})`, 'slateblue');

const {keys, entries, values, create} = Object;
const nob = () => create(null);

export class Arc extends EventEmitter {
  log;
  id;
  meta;
  stores;
  hosts;
  surface;
  composer;
  hostService;
  constructor(id, meta, surface) {
    super();
    this.id = id;
    this.meta = meta;
    this.surface = surface;
    this.hosts = nob();
    this.stores = nob();
    this.log = customLogFactory(id);
  }
  async addHost(host: Host, surface?) {
    // to support hosts we need a composer
    await this.ensureComposer();
    // bookkeep
    this.hosts[host.id] = host;
    host.arc = this;
    // support per host surfacing?
    //await host.bindToSurface(surface ?? this.surface);
    // begin work
    this.updateHost(host);
    return host;
  }
  protected async ensureComposer() {
    if (!this.composer && this.surface) {
      // create composer
      this.composer = await this.surface.createComposer('root');
      // pipeline for events from composer to this.onevent
      // TODO(sjmiles): use 'bind' to avoid a closure and improve the stack trace
      this.composer.onevent = this.onevent.bind(this);
    }
  }
  removeHost(id) {
    this.hosts[id]?.detach();
    delete this.hosts[id];
  }
  addStore(storeId, store) {
    if (store && !this.stores[storeId]) {
      this.stores[storeId] = store;
      store.listen('change', () => this.storeChanged(storeId, store));
    }
  }
  removeStore(storeId) {
    if (this.stores[storeId]) {
      // TODO(sjmiles): must `unlisten` to match `listen` above
      //this.stores[storeId].onChange = null;
    }
    delete this.stores[storeId];
  }
  // TODO(sjmiles): 2nd param is used in overrides, make explicit
  protected storeChanged(storeId, store) {
    this.log(`storeChanged: "${storeId}"`);
    values(this.hosts).forEach((host: Host) => {
      const bindings = host.meta?.bindings;
      const isBound = bindings && entries(bindings).some(([n, v]) => (v || n) === storeId);
      if (isBound) {
        this.log(`host "${host.id}" has interest in "${storeId}"`);
        // TODO(sjmiles): we only have to update inputs for storeId, we lose efficiency here
        this.updateHost(host);
      }
    });
  }
  updateHost(host) {
    host.inputs = this.computeInputs(host);
  }
  // TODO(sjmiles): debounce? (update is sync-debounced already)
  // complement to `assignOutputs`
  protected computeInputs(host) {
    const inputs = nob();
    const bindings = host.meta?.bindings;
    const staticInputs = host.meta?.inputs;
    if (bindings) {
      keys(bindings).forEach(name => this.computeInput(name, bindings, staticInputs, inputs));
      this.log(`computeInputs(${host.id}) =`, inputs);
    }
    return inputs;
  }
  protected computeInput(name, bindings, staticInputs, inputs) {
    // TODO(sjmiles): implement _conditional_ bindings that are dynamic at runtime to allow directing data flow (c.f. FooImageRef)
    const storeName = bindings[name] || name;
    // find referenced store
    const store = this.stores[storeName];
    if (store) {
      //this.log(`computeInputs: using "${storeName}" (bound to "${name}")`);
      inputs[name] = store.pojo;
    } else {
      this.log.error(`computeInputs: "${storeName}" (bound to "${name}") not found`);
    }
    if (!(inputs[name]?.length > 0)  && staticInputs?.[name]) {
      inputs[name] = staticInputs[name];
    }
  }
  // complement to `computeInputs`
  assignOutputs({id, meta}, outputs) {
    const names = keys(outputs);
    if (meta?.bindings && names.length) {
      //this.log.group(`assignOutputs(${host.id}, {${keys}})`);
      this.log(`[start][${id}] assignOutputs({${names}})`);
      names.forEach(name => this.assignOutput(name, this.stores, outputs[name], meta.bindings));
      //this.log.groupEnd();
      this.log(`[end][${id}] assignOutputs({${names}})`);
    }
  }
  protected assignOutput(name, stores, output, bindings) {
    if (output !== undefined) {
      const binding = bindings[name] || name;
      this.log(`assignOutputs: property "${name}" is bound to store "${binding}"`);
      const store = stores[binding];
      if (!store) {
        this.log.warn(`assignOutputs: no store named "${binding}"`);
      } else {
        // Note: users can mess up output data in any way they see fit, so we should
        // probably invent `outputCleansing`.
        //this.log(`assignOutputs: "${binding}" is dirty, updating Store`, output);
        store.data = output;
      }
    }
  }
  async render(packet) {
    this.log('render', packet, Boolean(this.composer));
    if (this.composer) {
      this.composer.render(packet);
    }
  }
  onevent(pid, eventlet) {
    const host = this.hosts[pid];
    if (host) {
      host.handleEvent(eventlet);
    }
  }
  service(host, request) {
    return this.hostService?.(host, request);
  }
}
