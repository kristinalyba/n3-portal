/** @license MIT - N3.js 0.4.5 (browser build) - ©Ruben Verborgh */
(function (N3) {
(function () {
// **N3Util** provides N3 utility functions

var Xsd = 'http://www.w3.org/2001/XMLSchema#';
var XsdString  = Xsd + 'string';
var XsdInteger = Xsd + 'integer';
var XsdDecimal = Xsd + 'decimal';
var XsdBoolean = Xsd + 'boolean';
var RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

var N3Util = {
  // Tests whether the given entity (triple object) represents an IRI in the N3 library
  isIRI: function (entity) {
    if (!entity)
      return entity;
    var firstChar = entity[0];
    return firstChar !== '"' && firstChar !== '_';
  },

  // Tests whether the given entity (triple object) represents a literal in the N3 library
  isLiteral: function (entity) {
    return entity && entity[0] === '"';
  },

  // Tests whether the given entity (triple object) represents a blank node in the N3 library
  isBlank: function (entity) {
    return entity && entity.substr(0, 2) === '_:';
  },

  // Gets the string value of a literal in the N3 library
  getLiteralValue: function (literal) {
    var match = /^"([^]*)"/.exec(literal);
    if (!match)
      throw new Error(literal + ' is not a literal');
    return match[1];
  },

  // Gets the type of a literal in the N3 library
  getLiteralType: function (literal) {
    var match = /^"[^]*"(?:\^\^([^"]+)|(@)[^@"]+)?$/.exec(literal);
    if (!match)
      throw new Error(literal + ' is not a literal');
    return match[1] || (match[2] ? RdfLangString : XsdString);
  },

  // Gets the language of a literal in the N3 library
  getLiteralLanguage: function (literal) {
    var match = /^"[^]*"(?:@([^@"]+)|\^\^[^"]+)?$/.exec(literal);
    if (!match)
      throw new Error(literal + ' is not a literal');
    return match[1] ? match[1].toLowerCase() : '';
  },

  // Tests whether the given entity (triple object) represents a prefixed name
  isPrefixedName: function (entity) {
    return entity && /^[^:\/"']*:[^:\/"']+$/.test(entity);
  },

  // Expands the prefixed name to a full IRI (also when it occurs as a literal's type)
  expandPrefixedName: function (prefixedName, prefixes) {
    var match = /(?:^|"\^\^)([^:\/#"'\^_]*):[^\/]*$/.exec(prefixedName), prefix, base, index;
    if (match)
      prefix = match[1], base = prefixes[prefix], index = match.index;
    if (base === undefined)
      return prefixedName;

    // The match index is non-zero when expanding a literal's type.
    return index === 0 ? base + prefixedName.substr(prefix.length + 1)
                       : prefixedName.substr(0, index + 3) +
                         base + prefixedName.substr(index + prefix.length + 4);
  },

  // Creates an IRI in N3.js representation
  createIRI: function (iri) {
    return iri && iri[0] === '"' ? N3Util.getLiteralValue(iri) : iri;
  },

  // Creates a literal in N3.js representation
  createLiteral: function (value, modifier) {
    if (!modifier) {
      switch (typeof value) {
      case 'boolean':
        modifier = XsdBoolean;
        break;
      case 'number':
        if (isFinite(value)) {
          modifier = value % 1 === 0 ? XsdInteger : XsdDecimal;
          break;
        }
      default:
        return '"' + value + '"';
      }
    }
    return '"' + value +
           (/^[a-z]+(-[a-z0-9]+)*$/i.test(modifier) ? '"@'  + modifier.toLowerCase()
                                                    : '"^^' + modifier);
  },
};

// Add the N3Util functions to the given object or its prototype
function addN3Util(parent, toPrototype) {
  for (var name in N3Util)
    if (!toPrototype)
      parent[name] = N3Util[name];
    else
      parent.prototype[name] = applyToThis(N3Util[name]);

  return parent;
}

// Returns a function that applies `f` to the `this` object
function applyToThis(f) {
  return function (a) { return f(this, a); };
}

// Expose N3Util, attaching all functions to it

N3.Util = addN3Util(addN3Util);

})();
(function () {
// **N3Lexer** tokenizes N3 documents.
var fromCharCode = String.fromCharCode;
var immediately = typeof setImmediate === 'function' ? setImmediate :
                  function setImmediate(func) { setTimeout(func, 0); };

// Regular expression and replacement string to escape N3 strings.
// Note how we catch invalid unicode sequences separately (they will trigger an error).
var escapeSequence = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{8})|\\[uU]|\\(.)/g;
var escapeReplacements = { '\\': '\\', "'": "'", '"': '"',
                           'n': '\n', 'r': '\r', 't': '\t', 'f': '\f', 'b': '\b',
                           '_': '_', '~': '~', '.': '.', '-': '-', '!': '!', '$': '$', '&': '&',
                           '(': '(', ')': ')', '*': '*', '+': '+', ',': ',', ';': ';', '=': '=',
                           '/': '/', '?': '?', '#': '#', '@': '@', '%': '%' };
var illegalIriChars = /[\x00-\x20<>\\"\{\}\|\^\`]/;

// ## Constructor
function N3Lexer(options) {
  if (!(this instanceof N3Lexer))
    return new N3Lexer(options);

  // In line mode (N-Triples or N-Quads), only simple features may be parsed
  if (options && options.lineMode) {
    // Don't tokenize special literals
    this._tripleQuotedString = this._number = this._boolean = /$0^/;
    // Swap the tokenize method for a restricted version
    var self = this;
    this._tokenize = this.tokenize;
    this.tokenize = function (input, callback) {
      this._tokenize(input, function (error, token) {
        if (!error && /^(?:IRI|prefixed|literal|langcode|type|\.|eof)$/.test(token.type))
          callback && callback(error, token);
        else
          callback && callback(error || self._syntaxError(token.type, callback = null));
      });
    };
  }
}

N3Lexer.prototype = {
  // ## Regular expressions
  // It's slightly faster to have these as properties than as in-scope variables.

  _iri: /^<((?:[^>\\]|\\[uU])+)>/, // IRI with escape sequences; needs sanity check after unescaping
  _unescapedIri: /^<([^\x00-\x20<>\\"\{\}\|\^\`]*)>/, // IRI without escape sequences; no unescaping
  _unescapedString: /^"[^"\\]+"(?=[^"\\])/, // non-empty string without escape sequences
  _singleQuotedString: /^"[^"\\]*(?:\\.[^"\\]*)*"(?=[^"\\])|^'[^'\\]*(?:\\.[^'\\]*)*'(?=[^'\\])/,
  _tripleQuotedString: /^""("[^"\\]*(?:(?:\\.|"(?!""))[^"\\]*)*")""|^''('[^'\\]*(?:(?:\\.|'(?!''))[^'\\]*)*')''/,
  _langcode: /^@([a-z]+(?:-[a-z0-9]+)*)(?=[^a-z0-9\-])/i,
  _prefix: /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:(?=[#\s<])/,
  _prefixed: /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:((?:(?:[0-:A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])(?:(?:[\.\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])*(?:[\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~]))?)?)(?=\.?[,;\s#()\[\]\{\}"'<])/,
  _blank: /^_:((?:[0-9A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)(?=\.?[,;:\s#()\[\]\{\}"'<])/,
  _number: /^[\-+]?(?:\d+\.?\d*([eE](?:[\-\+])?\d+)|\d*\.?\d+)(?=[.,;:\s#()\[\]\{\}"'<])/,
  _boolean: /^(?:true|false)(?=[.,;:\s#()\[\]\{\}"'<])/,
  _keyword: /^@[a-z]+(?=[\s#<:])/,
  _sparqlKeyword: /^(?:PREFIX|BASE|GRAPH)(?=[\s#<:])/i,
  _shortPredicates: /^a(?=\s+|<)/,
  _newline: /^[ \t]*(?:#[^\n\r]*)?(?:\r\n|\n|\r)[ \t]*/,
  _whitespace: /^[ \t]+/,
  _endOfFile: /^(?:#[^\n\r]*)?$/,

  // ## Private methods

  // ### `_tokenizeToEnd` tokenizes as for as possible, emitting tokens through the callback.
  _tokenizeToEnd: function (callback, inputFinished) {
    // Continue parsing as far as possible; the loop will return eventually.
    var input = this._input;
    while (true) {
      // Count and skip whitespace lines.
      var whiteSpaceMatch;
      while (whiteSpaceMatch = this._newline.exec(input))
        input = input.substr(whiteSpaceMatch[0].length, input.length), this._line++;
      // Skip whitespace on current line.
      if (whiteSpaceMatch = this._whitespace.exec(input))
        input = input.substr(whiteSpaceMatch[0].length, input.length);

      // Stop for now if we're at the end.
      if (this._endOfFile.test(input)) {
        // If the input is finished, emit EOF.
        if (inputFinished)
          callback(input = null, { line: this._line, type: 'eof', value: '', prefix: '' });
        return this._input = input;
      }

      // Look for specific token types based on the first character.
      var line = this._line, type = '', value = '', prefix = '',
          firstChar = input[0], match = null, matchLength = 0, unescaped, inconclusive = false;
      switch (firstChar) {
      case '^':
        // Try to match a type.
        if (input.length === 1) break;
        else if (input[1] !== '^') return reportSyntaxError(this);
        this._prevTokenType = '^';
        // Move to type IRI or prefixed name.
        input = input.substr(2);
        if (input[0] !== '<') {
          inconclusive = true;
          break;
        }
        // Fall through in case the type is an IRI.

      case '<':
        // Try to find a full IRI without escape sequences.
        if (match = this._unescapedIri.exec(input))
          type = 'IRI', value = match[1];
        // Try to find a full IRI with escape sequences.
        else if (match = this._iri.exec(input)) {
          unescaped = this._unescape(match[1]);
          if (unescaped === null || illegalIriChars.test(unescaped))
            return reportSyntaxError(this);
          type = 'IRI', value = unescaped;
        }
        break;

      case '_':
        // Try to find a blank node. Since it can contain (but not end with) a dot,
        // we always need a non-dot character before deciding it is a prefixed name.
        // Therefore, try inserting a space if we're at the end of the input.
        if ((match = this._blank.exec(input)) ||
            inputFinished && (match = this._blank.exec(input + ' ')))
          type = 'prefixed', prefix = '_', value = match[1];
        break;

      case '"':
      case "'":
        // Try to find a non-empty double-quoted literal without escape sequences.
        if (match = this._unescapedString.exec(input))
          type = 'literal', value = match[0];
        // Try to find any other literal wrapped in a pair of single or double quotes.
        else if (match = this._singleQuotedString.exec(input)) {
          unescaped = this._unescape(match[0]);
          if (unescaped === null)
            return reportSyntaxError(this);
          type = 'literal', value = unescaped.replace(/^'|'$/g, '"');
        }
        // Try to find a literal wrapped in three pairs of single or double quotes.
        else if (match = this._tripleQuotedString.exec(input)) {
          unescaped = match[1] || match[2];
          // Count the newlines and advance line counter.
          this._line += unescaped.split(/\r\n|\r|\n/).length - 1;
          unescaped = this._unescape(unescaped);
          if (unescaped === null)
            return reportSyntaxError(this);
          type = 'literal', value = unescaped.replace(/^'|'$/g, '"');
        }
        break;

      case '@':
        // Try to find a language code.
        if (this._prevTokenType === 'literal' && (match = this._langcode.exec(input)))
          type = 'langcode', value = match[1];
        // Try to find a keyword.
        else if (match = this._keyword.exec(input))
          type = match[0];
        break;

      case '.':
        // Try to find a dot as punctuation.
        if (input.length === 1 ? inputFinished : (input[1] < '0' || input[1] > '9')) {
          type = '.';
          matchLength = 1;
          break;
        }
        // Fall through to numerical case (could be a decimal dot).

      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '+':
      case '-':
        // Try to find a number.
        if (match = this._number.exec(input)) {
          type = 'literal';
          value = '"' + match[0] + '"^^http://www.w3.org/2001/XMLSchema#' +
                  (match[1] ? 'double' : (/^[+\-]?\d+$/.test(match[0]) ? 'integer' : 'decimal'));
        }
        break;

      case 'B':
      case 'b':
      case 'p':
      case 'P':
      case 'G':
      case 'g':
        // Try to find a SPARQL-style keyword.
        if (match = this._sparqlKeyword.exec(input))
          type = match[0].toUpperCase();
        else
          inconclusive = true;
        break;

      case 'f':
      case 't':
        // Try to match a boolean.
        if (match = this._boolean.exec(input))
          type = 'literal', value = '"' + match[0] + '"^^http://www.w3.org/2001/XMLSchema#boolean';
        else
          inconclusive = true;
        break;

      case 'a':
        // Try to find an abbreviated predicate.
        if (match = this._shortPredicates.exec(input))
          type = 'abbreviation', value = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
        else
          inconclusive = true;
        break;

      case ',':
      case ';':
      case '[':
      case ']':
      case '(':
      case ')':
      case '{':
      case '}':
        // The next token is punctuation
        matchLength = 1;
        type = firstChar;
        break;

      default:
        inconclusive = true;
      }

      // Some first characters do not allow an immediate decision, so inspect more.
      if (inconclusive) {
        // Try to find a prefix.
        if ((this._prevTokenType === '@prefix' || this._prevTokenType === 'PREFIX') &&
            (match = this._prefix.exec(input)))
          type = 'prefix', value = match[1] || '';
        // Try to find a prefixed name. Since it can contain (but not end with) a dot,
        // we always need a non-dot character before deciding it is a prefixed name.
        // Therefore, try inserting a space if we're at the end of the input.
        else if ((match = this._prefixed.exec(input)) ||
                 inputFinished && (match = this._prefixed.exec(input + ' ')))
          type = 'prefixed', prefix = match[1] || '', value = this._unescape(match[2]);
      }

      // A type token is special: it can only be emitted after an IRI or prefixed name is read.
      if (this._prevTokenType === '^')
        type = (type === 'IRI' || type === 'prefixed') ? 'type' : '';

      // What if nothing of the above was found?
      if (!type) {
        // We could be in streaming mode, and then we just wait for more input to arrive.
        // Otherwise, a syntax error has occurred in the input.
        // One exception: error on an unaccounted linebreak (= not inside a triple-quoted literal).
        if (inputFinished || (!/^'''|^"""/.test(input) && /\n|\r/.test(input)))
          return reportSyntaxError(this);
        else
          return this._input = input;
      }

      // Emit the parsed token.
      callback(null, { line: line, type: type, value: value, prefix: prefix });
      this._prevTokenType = type;

      // Advance to next part to tokenize.
      input = input.substr(matchLength || match[0].length, input.length);
    }

    // Signals the syntax error through the callback
    function reportSyntaxError(self) { callback(self._syntaxError(/^\S*/.exec(input)[0])); }
  },

  // ### `_unescape` replaces N3 escape codes by their corresponding characters.
  _unescape: function (item) {
    try {
      return item.replace(escapeSequence, function (sequence, unicode4, unicode8, escapedChar) {
        var charCode;
        if (unicode4) {
          charCode = parseInt(unicode4, 16);
          if (isNaN(charCode)) throw new Error(); // can never happen (regex), but helps performance
          return fromCharCode(charCode);
        }
        else if (unicode8) {
          charCode = parseInt(unicode8, 16);
          if (isNaN(charCode)) throw new Error(); // can never happen (regex), but helps performance
          if (charCode <= 0xFFFF) return fromCharCode(charCode);
          return fromCharCode(0xD800 + ((charCode -= 0x10000) / 0x400), 0xDC00 + (charCode & 0x3FF));
        }
        else {
          var replacement = escapeReplacements[escapedChar];
          if (!replacement)
            throw new Error();
          return replacement;
        }
      });
    }
    catch (error) { return null; }
  },

  // ### `_syntaxError` creates a syntax error for the given issue
  _syntaxError: function (issue) {
    this._input = null;
    return new Error('Syntax error: unexpected "' + issue + '" on line ' + this._line + '.');
  },


  // ## Public methods

  // ### `tokenize` starts the transformation of an N3 document into an array of tokens.
  // The input can be a string or a stream.
  tokenize: function (input, callback) {
    var self = this;
    this._line = 1;

    // If the input is a string, continuously emit tokens through the callback until the end.
    if (typeof input === 'string') {
      this._input = input;
      immediately(function () { self._tokenizeToEnd(callback, true); });
    }
    // Otherwise, the input will be streamed.
    else {
      this._input = '';

      // If no input was given, it will be streamed through `addChunk` and ended with `end`
      if (!input || typeof input === 'function') {
        this.addChunk = addChunk;
        this.end = end;
        if (!callback)
          callback = input;
      }
      // Otherwise, the input itself must be a stream
      else {
        if (typeof input.setEncoding === 'function')
          input.setEncoding('utf8');
        input.on('data', addChunk);
        input.on('end', end);
      }
    }

    // Adds the data chunk to the buffer and parses as far as possible
    function addChunk(data) {
      if (self._input !== null) {
        self._input += data;
        self._tokenizeToEnd(callback, false);
      }
    }

    // Parses until the end
    function end() {
      if (self._input !== null)
        self._tokenizeToEnd(callback, true);
    }
  },
};

// ## Exports

// Export the `N3Lexer` class as a whole.

N3.Lexer = N3Lexer;

})();
(function () {
/* */ 
var N3Lexer = N3.Lexer;
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

N3.Parser = N3Parser;

})();
(function () {
// **N3Writer** writes N3 documents.

// Matches a literal as represented in memory by the N3 library
var N3LiteralMatcher = /^"([^]*)"(?:\^\^(.+)|@([\-a-z]+))?$/i;

// rdf:type predicate (for 'a' abbreviation)
var RDF_PREFIX = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    RDF_TYPE   = RDF_PREFIX + 'type';

// Characters in literals that require escaping
var escape    = /["\\\t\n\r\b\f\u0000-\u0019\ud800-\udbff]/,
    escapeAll = /["\\\t\n\r\b\f\u0000-\u0019]|[\ud800-\udbff][\udc00-\udfff]/g,
    escapeReplacements = { '\\': '\\\\', '"': '\\"', '\t': '\\t',
                           '\n': '\\n', '\r': '\\r', '\b': '\\b', '\f': '\\f' };

// ## Constructor
function N3Writer(outputStream, options) {
  if (!(this instanceof N3Writer))
    return new N3Writer(outputStream, options);

  // Shift arguments if the first argument is not a stream
  if (outputStream && typeof outputStream.write !== 'function')
    options = outputStream, outputStream = null;
  options = options || {};

  // If no output stream given, send the output as string through the end callback
  if (!outputStream) {
    var output = '';
    this._outputStream = {
      write: function (chunk, encoding, done) { output += chunk; done && done(); },
      end:   function (done) { done && done(null, output); },
    };
    this._endStream = true;
  }
  else {
    this._outputStream = outputStream;
    this._endStream = options.end === undefined ? true : !!options.end;
  }

  // Initialize writer, depending on the format
  this._subject = null;
  if (!(/triple|quad/i).test(options.format)) {
    this._graph = '';
    this._prefixIRIs = Object.create(null);
    options.prefixes && this.addPrefixes(options.prefixes);
  }
  else {
    this._writeTriple = this._writeTripleLine;
  }
}

N3Writer.prototype = {
  // ## Private methods

  // ### `_write` writes the argument to the output stream
  _write: function (string, callback) {
    this._outputStream.write(string, 'utf8', callback);
  },

    // ### `_writeTriple` writes the triple to the output stream
  _writeTriple: function (subject, predicate, object, graph, done) {
    try {
      // Write the graph's label if it has changed
      if (this._graph !== graph) {
        // Close the previous graph and start the new one
        this._write((this._subject === null ? '' : (this._graph ? '\n}\n' : '.\n')) +
                    (graph ? this._encodeIriOrBlankNode(graph) + ' {\n' : ''));
        this._subject = null;
        // Don't treat identical blank nodes as repeating graphs
        this._graph = graph[0] !== '[' ? graph : ']';
      }
      // Don't repeat the subject if it's the same
      if (this._subject === subject) {
        // Don't repeat the predicate if it's the same
        if (this._predicate === predicate)
          this._write(', ' + this._encodeObject(object), done);
        // Same subject, different predicate
        else
          this._write(';\n    ' +
                      this._encodePredicate(this._predicate = predicate) + ' ' +
                      this._encodeObject(object), done);
      }
      // Different subject; write the whole triple
      else
        this._write((this._subject === null ? '' : '.\n') +
                    this._encodeSubject(this._subject = subject) + ' ' +
                    this._encodePredicate(this._predicate = predicate) + ' ' +
                    this._encodeObject(object), done);
    }
    catch (error) { done && done(error); }
  },

  // ### `_writeTripleLine` writes the triple or quad to the output stream as a single line
  _writeTripleLine: function (subject, predicate, object, graph, done) {
    // Don't use prefixes
    delete this._prefixMatch;
    // Write the triple
    try {
      this._write(this._encodeIriOrBlankNode(subject) + ' ' +
                  this._encodeIriOrBlankNode(predicate) + ' ' +
                  this._encodeObject(object) +
                  (graph ? ' ' + this._encodeIriOrBlankNode(graph) + '.\n' : '.\n'), done);
    }
    catch (error) { done && done(error); }
  },

  // ### `_encodeIriOrBlankNode` represents an IRI or blank node
  _encodeIriOrBlankNode: function (entity) {
    // A blank node or list is represented as-is
    var firstChar = entity[0];
    if (firstChar === '[' || firstChar === '(' || firstChar === '_' && entity[1] === ':')
      return entity;
    // Escape special characters
    if (escape.test(entity))
      entity = entity.replace(escapeAll, characterReplacer);
    // Try to represent the IRI as prefixed name
    var prefixMatch = this._prefixRegex.exec(entity);
    return !prefixMatch ? '<' + entity + '>' :
           (!prefixMatch[1] ? entity : this._prefixIRIs[prefixMatch[1]] + prefixMatch[2]);
  },

  // ### `_encodeLiteral` represents a literal
  _encodeLiteral: function (value, type, language) {
    // Escape special characters
    if (escape.test(value))
      value = value.replace(escapeAll, characterReplacer);
    // Write the literal, possibly with type or language
    if (language)
      return '"' + value + '"@' + language;
    else if (type)
      return '"' + value + '"^^' + this._encodeIriOrBlankNode(type);
    else
      return '"' + value + '"';
  },

  // ### `_encodeSubject` represents a subject
  _encodeSubject: function (subject) {
    if (subject[0] === '"')
      throw new Error('A literal as subject is not allowed: ' + subject);
    // Don't treat identical blank nodes as repeating subjects
    if (subject[0] === '[')
      this._subject = ']';
    return this._encodeIriOrBlankNode(subject);
  },

  // ### `_encodePredicate` represents a predicate
  _encodePredicate: function (predicate) {
    if (predicate[0] === '"')
      throw new Error('A literal as predicate is not allowed: ' + predicate);
    return predicate === RDF_TYPE ? 'a' : this._encodeIriOrBlankNode(predicate);
  },

  // ### `_encodeObject` represents an object
  _encodeObject: function (object) {
    // Represent an IRI or blank node
    if (object[0] !== '"')
      return this._encodeIriOrBlankNode(object);
    // Represent a literal
    var match = N3LiteralMatcher.exec(object);
    if (!match) throw new Error('Invalid literal: ' + object);
    return this._encodeLiteral(match[1], match[2], match[3]);
  },

  // ### `_blockedWrite` replaces `_write` after the writer has been closed
  _blockedWrite: function () {
    throw new Error('Cannot write because the writer has been closed.');
  },

  // ### `addTriple` adds the triple to the output stream
  addTriple: function (subject, predicate, object, graph, done) {
    // The triple was given as a triple object, so shift parameters
    if (object === undefined)
      this._writeTriple(subject.subject, subject.predicate, subject.object,
                        subject.graph || '', predicate);
    // The optional `graph` parameter was not provided
    else if (typeof graph !== 'string')
      this._writeTriple(subject, predicate, object, '', graph);
    // The `graph` parameter was provided
    else
      this._writeTriple(subject, predicate, object, graph, done);
  },

  // ### `addTriples` adds the triples to the output stream
  addTriples: function (triples) {
    for (var i = 0; i < triples.length; i++)
      this.addTriple(triples[i]);
  },

  // ### `addPrefix` adds the prefix to the output stream
  addPrefix: function (prefix, iri, done) {
    var prefixes = {};
    prefixes[prefix] = iri;
    this.addPrefixes(prefixes, done);
  },

  // ### `addPrefixes` adds the prefixes to the output stream
  addPrefixes: function (prefixes, done) {
    // Add all useful prefixes
    var prefixIRIs = this._prefixIRIs, hasPrefixes = false;
    for (var prefix in prefixes) {
      // Verify whether the prefix can be used and does not exist yet
      var iri = prefixes[prefix];
      if (/[#\/]$/.test(iri) && prefixIRIs[iri] !== (prefix += ':')) {
        hasPrefixes = true;
        prefixIRIs[iri] = prefix;
        // Finish a possible pending triple
        if (this._subject !== null) {
          this._write(this._graph ? '\n}\n' : '.\n');
          this._subject = null, this._graph = '';
        }
        // Write prefix
        this._write('@prefix ' + prefix + ' <' + iri + '>.\n');
      }
    }
    // Recreate the prefix matcher
    if (hasPrefixes) {
      var IRIlist = '', prefixList = '';
      for (var prefixIRI in prefixIRIs) {
        IRIlist += IRIlist ? '|' + prefixIRI : prefixIRI;
        prefixList += (prefixList ? '|' : '') + prefixIRIs[prefixIRI];
      }
      IRIlist = IRIlist.replace(/[\]\/\(\)\*\+\?\.\\\$]/g, '\\$&');
      this._prefixRegex = new RegExp('^(?:' + prefixList + ')[^\/]*$|' +
                                     '^(' + IRIlist + ')([a-zA-Z][\\-_a-zA-Z0-9]*)$');
    }
    // End a prefix block with a newline
    this._write(hasPrefixes ? '\n' : '', done);
  },

  // ### `blank` creates a blank node with the given content
  blank: function (predicate, object) {
    var children = predicate, child, length;
    // Empty blank node
    if (predicate === undefined)
      children = [];
    // Blank node passed as blank("predicate", "object")
    else if (typeof predicate === 'string')
      children = [{ predicate: predicate, object: object }];
    // Blank node passed as blank({ predicate: predicate, object: object })
    else if (!('length' in predicate))
      children = [predicate];

    switch (length = children.length) {
    // Generate an empty blank node
    case 0:
      return '[]';
    // Generate a non-nested one-triple blank node
    case 1:
      child = children[0];
      if (child.object[0] !== '[')
        return '[ ' + this._encodePredicate(child.predicate) + ' ' +
                      this._encodeObject(child.object) + ' ]';
    // Generate a multi-triple or nested blank node
    default:
      var contents = '[';
      // Write all triples in order
      for (var i = 0; i < length; i++) {
        child = children[i];
        // Write only the object is the predicate is the same as the previous
        if (child.predicate === predicate)
          contents += ', ' + this._encodeObject(child.object);
        // Otherwise, write the predicate and the object
        else {
          contents += (i ? ';\n  ' : '\n  ') +
                      this._encodePredicate(child.predicate) + ' ' +
                      this._encodeObject(child.object);
          predicate = child.predicate;
        }
      }
      return contents + '\n]';
    }
  },

  // ### `list` creates a list node with the given content
  list: function (elements) {
    var length = elements && elements.length || 0, contents = new Array(length);
    for (var i = 0; i < length; i++)
      contents[i] = this._encodeObject(elements[i]);
    return '(' + contents.join(' ') + ')';
  },

  // ### `_prefixRegex` matches a prefixed name or IRI that begins with one of the added prefixes
  _prefixRegex: /$0^/,

  // ### `end` signals the end of the output stream
  end: function (done) {
    // Finish a possible pending triple
    if (this._subject !== null) {
      this._write(this._graph ? '\n}\n' : '.\n');
      this._subject = null;
    }
    // Disallow further writing
    this._write = this._blockedWrite;

    // Try to end the underlying stream, ensuring done is called exactly one time
    var singleDone = done && function (error, result) { singleDone = null, done(error, result); };
    if (this._endStream) {
      try { return this._outputStream.end(singleDone); }
      catch (error) { /* error closing stream */ }
    }
    singleDone && singleDone();
  },
};

// Replaces a character by its escaped version
function characterReplacer(character) {
  // Replace a single character by its escaped version
  var result = escapeReplacements[character];
  if (result === undefined) {
    // Replace a single character with its 4-bit unicode escape sequence
    if (character.length === 1) {
      result = character.charCodeAt(0).toString(16);
      result = '\\u0000'.substr(0, 6 - result.length) + result;
    }
    // Replace a surrogate pair with its 8-bit unicode escape sequence
    else {
      result = ((character.charCodeAt(0) - 0xD800) * 0x400 +
                 character.charCodeAt(1) + 0x2400).toString(16);
      result = '\\U00000000'.substr(0, 10 - result.length) + result;
    }
  }
  return result;
}

// ## Exports

// Export the `N3Writer` class as a whole.

N3.Writer = N3Writer;

})();
(function () {
/* */ 
var expandPrefixedName = N3.Util.expandPrefixedName;
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

N3.Store = N3Store;

})();
})(typeof exports !== "undefined" ? exports : this.N3 = {});