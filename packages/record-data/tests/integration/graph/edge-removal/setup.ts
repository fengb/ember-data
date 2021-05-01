import { setupTest } from 'ember-qunit';
import { TestContext } from 'ember-test-helpers';

import { graphFor } from '@ember-data/record-data/-private';
import Store from '@ember-data/store';
import { DSModel } from '@ember-data/store/-private/ts-interfaces/ds-model';

type ManyRelationship = import('@ember-data/record-data/-private').ManyRelationship;

type CollectionResourceDocument = import('@ember-data/store/-private/ts-interfaces/ember-data-json-api').CollectionResourceDocument;
type EmptyResourceDocument = import('@ember-data/store/-private/ts-interfaces/ember-data-json-api').EmptyResourceDocument;
type JsonApiDocument = import('@ember-data/store/-private/ts-interfaces/ember-data-json-api').JsonApiDocument;
type SingleResourceDocument = import('@ember-data/store/-private/ts-interfaces/ember-data-json-api').SingleResourceDocument;
type BelongsToRelationship = import('@ember-data/record-data/-private').BelongsToRelationship;
type CoreStore = import('@ember-data/store/-private/system/core-store').default;
type Dict<T> = import('@ember-data/store/-private/ts-interfaces/utils').Dict<T>;
type Relationship = import('@ember-data/record-data/-private').Relationship;
type StableRecordIdentifier = import('@ember-data/store/-private/ts-interfaces/identifier').StableRecordIdentifier;

class AbstractMap {
  constructor(private store: CoreStore, private isImplicit: boolean) {}

  has(identifier: StableRecordIdentifier) {
    let graph = graphFor(this.store._storeWrapper);
    return graph.identifiers.has(identifier);
  }
}

class AbstractGraph {
  public identifiers: AbstractMap;
  public implicit: { has(identifier: StableRecordIdentifier): boolean };

  constructor(private store: CoreStore) {
    this.identifiers = new AbstractMap(store, false);
    this.implicit = {
      has: (identifier) => {
        return Object.keys(this.getImplicit(identifier)).length > 0;
      },
    };
  }

  get(
    identifier: StableRecordIdentifier,
    propertyName: string
  ): ManyRelationship | BelongsToRelationship | Relationship {
    return graphFor(this.store._storeWrapper).get(identifier, propertyName);
  }

  getImplicit(identifier: StableRecordIdentifier): Dict<Relationship> {
    const rels = graphFor(this.store._storeWrapper).identifiers.get(identifier);
    let implicits = Object.create(null);
    if (rels) {
      Object.keys(rels).forEach((key) => {
        let rel = rels[key]!;
        if (rel.definition.isImplicit) {
          implicits[key] = rel;
        }
      });
    }
    return implicits;
  }
}

function graphForTest(store: CoreStore) {
  return new AbstractGraph(store);
}

function isBelongsTo(rel: BelongsToRelationship | ManyRelationship | Relationship): rel is BelongsToRelationship {
  return rel.definition.kind === 'belongsTo';
}

export function stateOf(rel: BelongsToRelationship | ManyRelationship | Relationship) {
  let local, remote;
  if (isBelongsTo(rel)) {
    // we cast these to array form to make the tests more legible
    local = rel.localState ? [rel.localState] : [];
    remote = rel.remoteState ? [rel.remoteState] : [];
  } else {
    local = rel.members.list.map((m) => (m ? m : null));
    remote = rel.canonicalMembers.list.map((m) => (m ? m : null));
  }
  return {
    local,
    remote,
  };
}

class Adapter {
  static create() {
    return new this();
  }
  async deleteRecord() {
    return { data: null };
  }
}
class Serializer {
  static create() {
    return new this();
  }
  normalizeResponse(_, __, data) {
    return data;
  }
}

export interface UserRecord extends DSModel {
  name?: string;
  bestFriend?: UserRecord;
  bestFriends?: UserRecord[];
}

export interface Context extends TestContext {
  store: TestStore<UserRecord>;
  graph: AbstractGraph;
}

interface TestStore<T> extends CoreStore {
  push(data: EmptyResourceDocument): null;
  push(data: SingleResourceDocument): T;
  push(data: CollectionResourceDocument): T[];
  push(data: JsonApiDocument): T | T[] | null;
}

export function setupGraphTest(hooks) {
  setupTest(hooks);
  hooks.beforeEach(function (this: Context) {
    this.owner.register('service:store', Store);
    this.owner.register('adapter:application', Adapter);
    this.owner.register('serializer:application', Serializer);
    this.store = this.owner.lookup('service:store');
    this.graph = graphForTest(this.store);
  });
}
