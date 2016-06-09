/* */ 
var expandPrefixedName = require('./N3Util').expandPrefixedName;
function N3Store(triples, options) {
  if (!(this instanceof N3Store))
    return new N3Store(triples, options);
  this._size = 0;
  this._graphs = Object.create(null);
  this._entities = Object.create(null);
  this._entities['><'] = 0;
  this._entityCount = 0;
  this._blankNodeIndex = 0;
  if (!options && triples && !triples[0])
    options = triples, triples = null;
  this._prefixes = Object.create(null);
  if (options && options.prefixes)
    this.addPrefixes(options.prefixes);
  if (triples)
    this.addTriples(triples);
}
N3Store.prototype = {
  get size() {
    var size = this._size;
    if (size !== null)
      return size;
    var graphs = this._graphs,
        subjects,
        subject;
    for (var graphKey in graphs)
      for (var subjectKey in (subjects = graphs[graphKey].subjects))
        for (var predicateKey in (subject = subjects[subjectKey]))
          size += Object.keys(subject[predicateKey]).length;
    return this._size = size;
  },
  _addToIndex: function(index0, key0, key1, key2) {
    var index1 = index0[key0] || (index0[key0] = {});
    var index2 = index1[key1] || (index1[key1] = {});
    index2[key2] = null;
  },
  _removeFromIndex: function(index0, key0, key1, key2) {
    var index1 = index0[key0],
        index2 = index1[key1],
        key;
    delete index2[key2];
    for (key in index2)
      return;
    delete index1[key1];
    for (key in index1)
      return;
    delete index0[key0];
  },
  _findInIndex: function(index0, key0, key1, key2, name0, name1, name2, graph) {
    var results = [],
        entityKeys = Object.keys(this._entities),
        tmp,
        index1,
        index2;
    if (key0)
      (tmp = index0, index0 = {})[key0] = tmp[key0];
    for (var value0 in index0) {
      var entity0 = entityKeys[value0];
      if (index1 = index0[value0]) {
        if (key1)
          (tmp = index1, index1 = {})[key1] = tmp[key1];
        for (var value1 in index1) {
          var entity1 = entityKeys[value1];
          if (index2 = index1[value1]) {
            var values = key2 ? (key2 in index2 ? [key2] : []) : Object.keys(index2);
            for (var l = values.length - 1; l >= 0; l--) {
              var result = {
                subject: '',
                predicate: '',
                object: '',
                graph: graph
              };
              result[name0] = entity0;
              result[name1] = entity1;
              result[name2] = entityKeys[values[l]];
              results.push(result);
            }
          }
        }
      }
    }
    return results;
  },
  _countInIndex: function(index0, key0, key1, key2) {
    var count = 0,
        tmp,
        index1,
        index2;
    if (key0)
      (tmp = index0, index0 = {})[key0] = tmp[key0];
    for (var value0 in index0) {
      if (index1 = index0[value0]) {
        if (key1)
          (tmp = index1, index1 = {})[key1] = tmp[key1];
        for (var value1 in index1) {
          if (index2 = index1[value1]) {
            if (key2)
              (key2 in index2) && count++;
            else
              count += Object.keys(index2).length;
          }
        }
      }
    }
    return count;
  },
  addTriple: function(subject, predicate, object, graph) {
    if (!predicate)
      graph = subject.graph, object = subject.object, predicate = subject.predicate, subject = subject.subject;
    graph = graph || '';
    var graphItem = this._graphs[graph];
    if (!graphItem) {
      graphItem = this._graphs[graph] = {
        subjects: {},
        predicates: {},
        objects: {}
      };
      Object.freeze(graphItem);
    }
    var entities = this._entities;
    subject = entities[subject] || (entities[subject] = ++this._entityCount);
    predicate = entities[predicate] || (entities[predicate] = ++this._entityCount);
    object = entities[object] || (entities[object] = ++this._entityCount);
    this._addToIndex(graphItem.subjects, subject, predicate, object);
    this._addToIndex(graphItem.predicates, predicate, object, subject);
    this._addToIndex(graphItem.objects, object, subject, predicate);
    this._size = null;
  },
  addTriples: function(triples) {
    for (var i = triples.length - 1; i >= 0; i--)
      this.addTriple(triples[i]);
  },
  addPrefix: function(prefix, iri) {
    this._prefixes[prefix] = iri;
  },
  addPrefixes: function(prefixes) {
    for (var prefix in prefixes)
      this.addPrefix(prefix, prefixes[prefix]);
  },
  removeTriple: function(subject, predicate, object, graph) {
    if (!predicate)
      graph = subject.graph, object = subject.object, predicate = subject.predicate, subject = subject.subject;
    graph = graph || '';
    var graphItem,
        entities = this._entities,
        graphs = this._graphs;
    if (!(subject = entities[subject]))
      return;
    if (!(predicate = entities[predicate]))
      return;
    if (!(object = entities[object]))
      return;
    if (!(graphItem = graphs[graph]))
      return;
    var subjects,
        predicates;
    if (!(subjects = graphItem.subjects[subject]))
      return;
    if (!(predicates = subjects[predicate]))
      return;
    if (!(object in predicates))
      return;
    this._removeFromIndex(graphItem.subjects, subject, predicate, object);
    this._removeFromIndex(graphItem.predicates, predicate, object, subject);
    this._removeFromIndex(graphItem.objects, object, subject, predicate);
    if (this._size !== null)
      this._size--;
    for (subject in graphItem.subjects)
      return;
    delete graphs[graph];
  },
  removeTriples: function(triples) {
    for (var i = triples.length - 1; i >= 0; i--)
      this.removeTriple(triples[i]);
  },
  find: function(subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.findByIRI(expandPrefixedName(subject, prefixes), expandPrefixedName(predicate, prefixes), expandPrefixedName(object, prefixes), expandPrefixedName(graph, prefixes));
  },
  findByIRI: function(subject, predicate, object, graph) {
    graph = graph || '';
    var graphItem = this._graphs[graph],
        entities = this._entities;
    if (!graphItem)
      return [];
    if (subject && !(subject = entities[subject]))
      return [];
    if (predicate && !(predicate = entities[predicate]))
      return [];
    if (object && !(object = entities[object]))
      return [];
    if (subject) {
      if (object)
        return this._findInIndex(graphItem.objects, object, subject, predicate, 'object', 'subject', 'predicate', graph);
      else
        return this._findInIndex(graphItem.subjects, subject, predicate, null, 'subject', 'predicate', 'object', graph);
    } else if (predicate)
      return this._findInIndex(graphItem.predicates, predicate, object, null, 'predicate', 'object', 'subject', graph);
    else if (object)
      return this._findInIndex(graphItem.objects, object, null, null, 'object', 'subject', 'predicate', graph);
    else
      return this._findInIndex(graphItem.subjects, null, null, null, 'subject', 'predicate', 'object', graph);
  },
  count: function(subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.countByIRI(expandPrefixedName(subject, prefixes), expandPrefixedName(predicate, prefixes), expandPrefixedName(object, prefixes), expandPrefixedName(graph, prefixes));
  },
  countByIRI: function(subject, predicate, object, graph) {
    graph = graph || '';
    var graphItem = this._graphs[graph],
        entities = this._entities;
    if (!graphItem)
      return 0;
    if (subject && !(subject = entities[subject]))
      return 0;
    if (predicate && !(predicate = entities[predicate]))
      return 0;
    if (object && !(object = entities[object]))
      return 0;
    if (subject) {
      if (object)
        return this._countInIndex(graphItem.objects, object, subject, predicate);
      else
        return this._countInIndex(graphItem.subjects, subject, predicate, object);
    } else if (predicate) {
      return this._countInIndex(graphItem.predicates, predicate, object, subject);
    } else {
      return this._countInIndex(graphItem.objects, object, subject, predicate);
    }
  },
  createBlankNode: function(suggestedName) {
    var name,
        index;
    if (suggestedName) {
      name = suggestedName = '_:' + suggestedName, index = 1;
      while (this._entities[name])
        name = suggestedName + index++;
    } else {
      do {
        name = '_:b' + this._blankNodeIndex++;
      } while (this._entities[name]);
    }
    this._entities[name] = ++this._entityCount;
    return name;
  }
};
module.exports = N3Store;
