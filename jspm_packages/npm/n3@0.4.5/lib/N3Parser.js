/* */ 
var N3Lexer = require('./N3Lexer');
var RDF_PREFIX = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    RDF_NIL = RDF_PREFIX + 'nil',
    RDF_FIRST = RDF_PREFIX + 'first',
    RDF_REST = RDF_PREFIX + 'rest';
var absoluteIRI = /^[a-z][a-z0-9+.-]*:/i,
    schemeAuthority = /^(?:([a-z][a-z0-9+.-]*:))?(?:\/\/[^\/]*)?/i,
    dotSegments = /(?:^|\/)\.\.?(?:$|[\/#?])/;
var blankNodePrefix = 0,
    blankNodeCount = 0;
function N3Parser(options) {
  if (!(this instanceof N3Parser))
    return new N3Parser(options);
  this._tripleStack = [];
  this._graph = null;
  options = options || {};
  this._setBase(options.documentIRI);
  var format = (typeof options.format === 'string') && options.format.match(/\w*$/)[0].toLowerCase(),
      isTurtle = format === 'turtle',
      isTriG = format === 'trig',
      isNTriples = /triple/.test(format),
      isNQuads = /quad/.test(format),
      isLineMode = isNTriples || isNQuads;
  if (!(this._supportsNamedGraphs = !isTurtle))
    this._readPredicateOrNamedGraph = this._readPredicate;
  this._supportsQuads = !(isTurtle || isTriG || isNTriples);
  if (isLineMode) {
    this._base = '';
    this._resolveIRI = function(token) {
      this._error('Disallowed relative IRI', token);
      return this._callback = noop, this._subject = null;
    };
  }
  this._blankNodePrefix = typeof options.blankNodePrefix !== 'string' ? '' : '_:' + options.blankNodePrefix.replace(/^_:/, '');
  this._lexer = options.lexer || new N3Lexer({lineMode: isLineMode});
}
N3Parser._resetBlankNodeIds = function() {
  blankNodePrefix = blankNodeCount = 0;
};
N3Parser.prototype = {
  _setBase: function(baseIRI) {
    if (!baseIRI)
      baseIRI = null;
    else if (baseIRI.indexOf('#') >= 0)
      throw new Error('Invalid base IRI ' + baseIRI);
    if (this._base = baseIRI) {
      this._basePath = baseIRI.replace(/[^\/?]*(?:\?.*)?$/, '');
      baseIRI = baseIRI.match(schemeAuthority);
      this._baseRoot = baseIRI[0];
      this._baseScheme = baseIRI[1];
    }
  },
  _readInTopContext: function(token) {
    switch (token.type) {
      case 'eof':
        if (this._graph !== null)
          return this._error('Unclosed graph', token);
        delete this._prefixes._;
        return this._callback(null, null, this._prefixes);
      case '@prefix':
        this._sparqlStyle = false;
        return this._readPrefix;
      case 'PREFIX':
        this._sparqlStyle = true;
        return this._readPrefix;
      case '@base':
        this._sparqlStyle = false;
        return this._readBaseIRI;
      case 'BASE':
        this._sparqlStyle = true;
        return this._readBaseIRI;
      case '{':
        if (this._supportsNamedGraphs) {
          this._graph = '';
          this._subject = null;
          return this._readSubject;
        }
      case 'GRAPH':
        if (this._supportsNamedGraphs)
          return this._readNamedGraphLabel;
      default:
        return this._readSubject(token);
    }
  },
  _readSubject: function(token) {
    this._predicate = null;
    switch (token.type) {
      case 'IRI':
        if (this._base === null || absoluteIRI.test(token.value))
          this._subject = token.value;
        else
          this._subject = this._resolveIRI(token);
        break;
      case 'prefixed':
        var prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error('Undefined prefix "' + token.prefix + ':"', token);
        this._subject = prefix + token.value;
        break;
      case '[':
        this._subject = '_:b' + blankNodeCount++;
        this._tripleStack.push({
          subject: this._subject,
          predicate: null,
          object: null,
          type: 'blank'
        });
        return this._readBlankNodeHead;
      case '(':
        this._tripleStack.push({
          subject: RDF_NIL,
          predicate: null,
          object: null,
          type: 'list'
        });
        this._subject = null;
        return this._readListItem;
      case '}':
        return this._readPunctuation(token);
      default:
        return this._error('Expected subject but got ' + token.type, token);
    }
    return this._readPredicateOrNamedGraph;
  },
  _readPredicate: function(token) {
    var type = token.type;
    switch (type) {
      case 'IRI':
      case 'abbreviation':
        if (this._base === null || absoluteIRI.test(token.value))
          this._predicate = token.value;
        else
          this._predicate = this._resolveIRI(token);
        break;
      case 'prefixed':
        if (token.prefix === '_')
          return this._error('Disallowed blank node as predicate', token);
        var prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error('Undefined prefix "' + token.prefix + ':"', token);
        this._predicate = prefix + token.value;
        break;
      case '.':
      case ']':
      case '}':
        if (this._predicate === null)
          return this._error('Unexpected ' + type, token);
        this._subject = null;
        return type === ']' ? this._readBlankNodeTail(token) : this._readPunctuation(token);
      case ';':
        return this._readPredicate;
      default:
        return this._error('Expected predicate to follow "' + this._subject + '"', token);
    }
    return this._readObject;
  },
  _readObject: function(token) {
    switch (token.type) {
      case 'IRI':
        if (this._base === null || absoluteIRI.test(token.value))
          this._object = token.value;
        else
          this._object = this._resolveIRI(token);
        break;
      case 'prefixed':
        var prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error('Undefined prefix "' + token.prefix + ':"', token);
        this._object = prefix + token.value;
        break;
      case 'literal':
        this._object = token.value;
        return this._readDataTypeOrLang;
      case '[':
        var blank = '_:b' + blankNodeCount++;
        this._tripleStack.push({
          subject: this._subject,
          predicate: this._predicate,
          object: blank,
          type: 'blank'
        });
        this._subject = blank;
        return this._readBlankNodeHead;
      case '(':
        this._tripleStack.push({
          subject: this._subject,
          predicate: this._predicate,
          object: RDF_NIL,
          type: 'list'
        });
        this._subject = null;
        return this._readListItem;
      default:
        return this._error('Expected object to follow "' + this._predicate + '"', token);
    }
    return this._getTripleEndReader();
  },
  _readPredicateOrNamedGraph: function(token) {
    return token.type === '{' ? this._readGraph(token) : this._readPredicate(token);
  },
  _readGraph: function(token) {
    if (token.type !== '{')
      return this._error('Expected graph but got ' + token.type, token);
    this._graph = this._subject, this._subject = null;
    return this._readSubject;
  },
  _readBlankNodeHead: function(token) {
    if (token.type === ']') {
      this._subject = null;
      return this._readBlankNodeTail(token);
    } else {
      this._predicate = null;
      return this._readPredicate(token);
    }
  },
  _readBlankNodeTail: function(token) {
    if (token.type !== ']')
      return this._readBlankNodePunctuation(token);
    if (this._subject !== null)
      this._callback(null, {
        subject: this._subject,
        predicate: this._predicate,
        object: this._object,
        graph: this._graph || ''
      });
    var triple = this._tripleStack.pop();
    this._subject = triple.subject;
    if (triple.object !== null) {
      this._predicate = triple.predicate;
      this._object = triple.object;
      return this._getTripleEndReader();
    }
    return this._predicate !== null ? this._readPredicate : this._readPredicateOrNamedGraph;
  },
  _readDataTypeOrLang: function(token) {
    switch (token.type) {
      case 'type':
        var value;
        if (token.prefix === '') {
          if (this._base === null || absoluteIRI.test(token.value))
            value = token.value;
          else
            value = this._resolveIRI(token);
        } else {
          var prefix = this._prefixes[token.prefix];
          if (prefix === undefined)
            return this._error('Undefined prefix "' + token.prefix + ':"', token);
          value = prefix + token.value;
        }
        this._object += '^^' + value;
        return this._getTripleEndReader();
      case 'langcode':
        this._object += '@' + token.value.toLowerCase();
        return this._getTripleEndReader();
      default:
        return this._getTripleEndReader().call(this, token);
    }
  },
  _readListItem: function(token) {
    var item = null,
        itemHead = null,
        prevItemHead = this._subject,
        stack = this._tripleStack,
        parentTriple = stack[stack.length - 1],
        next = this._readListItem;
    switch (token.type) {
      case 'IRI':
        if (this._base === null || absoluteIRI.test(token.value))
          item = token.value;
        else
          item = this._resolveIRI(token);
        break;
      case 'prefixed':
        var prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error('Undefined prefix "' + token.prefix + ':"', token);
        item = prefix + token.value;
        break;
      case 'literal':
        item = token.value;
        next = this._readDataTypeOrLang;
        break;
      case '[':
        itemHead = '_:b' + blankNodeCount++;
        item = '_:b' + blankNodeCount++;
        stack.push({
          subject: itemHead,
          predicate: RDF_FIRST,
          object: item,
          type: 'blank'
        });
        this._subject = item;
        next = this._readBlankNodeHead;
        break;
      case '(':
        itemHead = '_:b' + blankNodeCount++;
        stack.push({
          subject: itemHead,
          predicate: RDF_FIRST,
          object: RDF_NIL,
          type: 'list'
        });
        this._subject = null;
        next = this._readListItem;
        break;
      case ')':
        stack.pop();
        if (stack.length !== 0 && stack[stack.length - 1].type === 'list')
          this._callback(null, {
            subject: parentTriple.subject,
            predicate: parentTriple.predicate,
            object: parentTriple.object,
            graph: this._graph || ''
          });
        this._subject = parentTriple.subject;
        if (parentTriple.predicate === null) {
          next = this._readPredicate;
          if (parentTriple.subject === RDF_NIL)
            return next;
        } else {
          this._predicate = parentTriple.predicate;
          this._object = parentTriple.object;
          next = this._getTripleEndReader();
          if (parentTriple.object === RDF_NIL)
            return next;
        }
        itemHead = RDF_NIL;
        break;
      default:
        return this._error('Expected list item instead of "' + token.type + '"', token);
    }
    if (itemHead === null)
      this._subject = itemHead = '_:b' + blankNodeCount++;
    if (prevItemHead === null) {
      if (parentTriple.object === RDF_NIL)
        parentTriple.object = itemHead;
      else
        parentTriple.subject = itemHead;
    } else {
      this._callback(null, {
        subject: prevItemHead,
        predicate: RDF_REST,
        object: itemHead,
        graph: this._graph || ''
      });
    }
    if (item !== null)
      this._callback(null, {
        subject: itemHead,
        predicate: RDF_FIRST,
        object: item,
        graph: this._graph || ''
      });
    return next;
  },
  _readPunctuation: function(token) {
    var next,
        subject = this._subject,
        graph = this._graph;
    switch (token.type) {
      case '}':
        if (this._graph === null)
          return this._error('Unexpected graph closing', token);
        this._graph = null;
      case '.':
        this._subject = null;
        next = this._readInTopContext;
        break;
      case ';':
        next = this._readPredicate;
        break;
      case ',':
        next = this._readObject;
        break;
      case 'IRI':
        if (this._supportsQuads && this._graph === null) {
          if (this._base === null || absoluteIRI.test(token.value))
            graph = token.value;
          else
            graph = this._resolveIRI(token);
          subject = this._subject;
          next = this._readQuadPunctuation;
          break;
        }
      case 'prefixed':
        if (this._supportsQuads && this._graph === null) {
          var prefix = this._prefixes[token.prefix];
          if (prefix === undefined)
            return this._error('Undefined prefix "' + token.prefix + ':"', token);
          graph = prefix + token.value;
          next = this._readQuadPunctuation;
          break;
        }
      default:
        return this._error('Expected punctuation to follow "' + this._object + '"', token);
    }
    if (subject !== null)
      this._callback(null, {
        subject: subject,
        predicate: this._predicate,
        object: this._object,
        graph: graph || ''
      });
    return next;
  },
  _readBlankNodePunctuation: function(token) {
    var next;
    switch (token.type) {
      case ';':
        next = this._readPredicate;
        break;
      case ',':
        next = this._readObject;
        break;
      default:
        return this._error('Expected punctuation to follow "' + this._object + '"', token);
    }
    this._callback(null, {
      subject: this._subject,
      predicate: this._predicate,
      object: this._object,
      graph: this._graph || ''
    });
    return next;
  },
  _readQuadPunctuation: function(token) {
    if (token.type !== '.')
      return this._error('Expected dot to follow quad', token);
    return this._readInTopContext;
  },
  _readPrefix: function(token) {
    if (token.type !== 'prefix')
      return this._error('Expected prefix to follow @prefix', token);
    this._prefix = token.value;
    return this._readPrefixIRI;
  },
  _readPrefixIRI: function(token) {
    if (token.type !== 'IRI')
      return this._error('Expected IRI to follow prefix "' + this._prefix + ':"', token);
    var prefixIRI;
    if (this._base === null || absoluteIRI.test(token.value))
      prefixIRI = token.value;
    else
      prefixIRI = this._resolveIRI(token);
    this._prefixes[this._prefix] = prefixIRI;
    this._prefixCallback(this._prefix, prefixIRI);
    return this._readDeclarationPunctuation;
  },
  _readBaseIRI: function(token) {
    if (token.type !== 'IRI')
      return this._error('Expected IRI to follow base declaration', token);
    try {
      this._setBase(this._base === null || absoluteIRI.test(token.value) ? token.value : this._resolveIRI(token));
    } catch (error) {
      this._error(error.message, token);
    }
    return this._readDeclarationPunctuation;
  },
  _readNamedGraphLabel: function(token) {
    switch (token.type) {
      case 'IRI':
      case 'prefixed':
        return this._readSubject(token), this._readGraph;
      case '[':
        return this._readNamedGraphBlankLabel;
      default:
        return this._error('Invalid graph label', token);
    }
  },
  _readNamedGraphBlankLabel: function(token) {
    if (token.type !== ']')
      return this._error('Invalid graph label', token);
    this._subject = '_:b' + blankNodeCount++;
    return this._readGraph;
  },
  _readDeclarationPunctuation: function(token) {
    if (this._sparqlStyle)
      return this._readInTopContext(token);
    if (token.type !== '.')
      return this._error('Expected declaration to end with a dot', token);
    return this._readInTopContext;
  },
  _getTripleEndReader: function() {
    var stack = this._tripleStack;
    if (stack.length === 0)
      return this._readPunctuation;
    switch (stack[stack.length - 1].type) {
      case 'blank':
        return this._readBlankNodeTail;
      case 'list':
        return this._readListItem;
    }
  },
  _error: function(message, token) {
    this._callback(new Error(message + ' at line ' + token.line + '.'));
  },
  _resolveIRI: function(token) {
    var iri = token.value;
    switch (iri[0]) {
      case undefined:
        return this._base;
      case '#':
        return this._base + iri;
      case '?':
        return this._base.replace(/(?:\?.*)?$/, iri);
      case '/':
        return (iri[1] === '/' ? this._baseScheme : this._baseRoot) + this._removeDotSegments(iri);
      default:
        return this._removeDotSegments(this._basePath + iri);
    }
  },
  _removeDotSegments: function(iri) {
    if (!dotSegments.test(iri))
      return iri;
    var result = '',
        length = iri.length,
        i = -1,
        pathStart = -1,
        segmentStart = 0,
        next = '/';
    while (i < length) {
      switch (next) {
        case ':':
          if (pathStart < 0) {
            if (iri[++i] === '/' && iri[++i] === '/')
              while ((pathStart = i + 1) < length && iri[pathStart] !== '/')
                i = pathStart;
          }
          break;
        case '?':
        case '#':
          i = length;
          break;
        case '/':
          if (iri[i + 1] === '.') {
            next = iri[++i + 1];
            switch (next) {
              case '/':
                result += iri.substring(segmentStart, i - 1);
                segmentStart = i + 1;
                break;
              case undefined:
              case '?':
              case '#':
                return result + iri.substring(segmentStart, i) + iri.substr(i + 1);
              case '.':
                next = iri[++i + 1];
                if (next === undefined || next === '/' || next === '?' || next === '#') {
                  result += iri.substring(segmentStart, i - 2);
                  if ((segmentStart = result.lastIndexOf('/')) >= pathStart)
                    result = result.substr(0, segmentStart);
                  if (next !== '/')
                    return result + '/' + iri.substr(i + 1);
                  segmentStart = i + 1;
                }
            }
          }
      }
      next = iri[++i];
    }
    return result + iri.substring(segmentStart);
  },
  parse: function(input, tripleCallback, prefixCallback) {
    this._readCallback = this._readInTopContext;
    this._prefixes = Object.create(null);
    this._prefixes._ = this._blankNodePrefix || '_:b' + blankNodePrefix++ + '_';
    if (typeof input === 'function')
      prefixCallback = tripleCallback, tripleCallback = input, input = null;
    this._callback = tripleCallback || noop;
    this._prefixCallback = prefixCallback || noop;
    var self = this;
    this._lexer.tokenize(input, function(error, token) {
      if (error !== null)
        self._callback(error), self._callback = noop;
      else if (self._readCallback !== undefined)
        self._readCallback = self._readCallback(token);
    });
    if (!input) {
      this.addChunk = this._lexer.addChunk;
      this.end = this._lexer.end;
    }
  }
};
function noop() {}
module.exports = N3Parser;
