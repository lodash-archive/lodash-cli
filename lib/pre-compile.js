'use strict';

/** Load Node.js modules. */
var fs = require('fs');

/** Load other modules. */
var _ = require('lodash-compat');

/** Used to minify variables and string values to a single character. */
var minNames = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
minNames.push.apply(minNames, minNames.map(function(value) {
  return value + value;
}));

/** Used to protect the specified properties from getting minified. */
var propWhitelist = _.union(
  _.keys(_),
  _.keys(_.prototype),
  _.keys(_.support),
  _.keys(_.templateSettings), [
  'BYTES_PER_ELEMENT',
  'NEGATIVE_INFINITY',
  'POSITIVE_INFINITY',
  'Array',
  'ArrayBuffer',
  'Boolean',
  'Cache',
  'Date',
  'Error',
  'Float32Array',
  'Float64Array',
  'Function',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Math',
  'Number',
  'Object',
  'RegExp',
  'Set',
  'String',
  'TypeError',
  'Uint8Array',
  'Uint8ClampedArray',
  'Uint16Array',
  'Uint32Array',
  'WeakMap',
  'WinRTError',
  '__actions__',
  '__chain__',
  '__data__',
  '__dir__',
  '__filtered__',
  '__iteratees__',
  '__takeCount__',
  '__views__',
  '__wrapped__',
  'add',
  'args',
  'amd',
  'buffer',
  'byteLength',
  'cache',
  'cancel',
  'clearTimeout',
  'count',
  'createDocumentFragment',
  'criteria',
  'data',
  'delete',
  'document',
  'done',
  'end',
  'exports',
  'func',
  'get',
  'getOwnPropertySymbols',
  'global',
  'has',
  'hash',
  'index',
  'iteratee',
  'leading',
  'length',
  'limit',
  'maxWait',
  'name',
  'nodeType',
  'omission',
  'parseFloat',
  'placeholder',
  'self',
  'separator',
  'set',
  'setTimeout',
  'size',
  'source',
  'sourceURL',
  'start',
  'thisArg',
  'trailing',
  'type',
  'value',
  'window'
]);

/*----------------------------------------------------------------------------*/

/**
 * Pre-process a given lodash `source`, preparing it for minification.
 *
 * @param {string} [source=''] The source to process.
 * @param {Object} [options={}] The options object.
 * @returns {string} Returns the processed source.
 */
function preprocess(source, options) {
  source || (source = '');
  options || (options = {});

  // Remove unrecognized JSDoc tags so the Closure Compiler won't complain.
  source = source.replace(/@(?:alias|category)\b.*/g, '');

  if (options.isTemplate) {
    return source;
  }
  // Remove whitespace from `_.template` related regexes.
  source = source.replace(/(reEmptyString\w+\s*=)([\s\S]+?)(?=[,;]\n)/g, function(match, left, value) {
    return left + value.replace(/\s|\\n/g, '');
  });

  // Remove whitespace from `_.template`.
  source = source.replace(/^( *)function template\b[\s\S]+?\n\1}/m, function(snippet) {
    // Remove whitespace from string literals.
    snippet = snippet.replace(/^((?:[ "'$\w]+:)?\s*)"[^"\n\\]*?(?:\\.[^"\n\\]*?)*"|'[^'\n\\]*?(?:\\.[^'\n\\]*?)*'/gm, function(string, left) {
      // Clip `string` after an object literal property name or leading spaces.
      if (left) {
        string = string.slice(left.length);
      }
      // Avoids removing the '\n' of the `stringEscapes` object.
      string = string.replace(/\[object |delete |else (?!{)|function | in | instanceof |return\s+["'$\w]|throw |typeof |use strict|var |# |(["'])(?:\\n| )\1|\\\\n|\\n|\s+/g, function(match) {
        return match == false || match == '\\n' ? '' : match;
      });
      // Unclip `string`.
      return (left || '') + string;
    });

    // Remove newline from double-quoted strings.
    snippet = snippet
      .replace('"__p += \'"', '"__p+=\'"')
      .replace('"\';\\n"', '"\';"');

    // Add a newline back so "evaluate" delimiters can support single line comments.
    snippet = snippet.replace('";__p+=\'"', '";\\n__p+=\'"');

    // Remove default `sourceURL` value.
    return snippet.replace(/^( *var\s+sourceURL\s*=\s*)[\s\S]+?(?=;\n$)/m, function(match, left) {
      return left + "'sourceURL' in options ? '//# sourceURL=' + options.sourceURL + '\\n' : ''";
    });
  });

  // Minify internal properties.
  (function() {
    var funcNames = [
      'baseSortBy',
      'baseSortByOrder',
      'compareAscending',
      'compareMultiple',
      'sortBy'
    ];

    var props = [
      'criteria',
      'index',
      'value'
    ];

    // Minify properties used in `funcNames` functions.
    var snippets = source.match(RegExp('^( *)(?:var|function) +(?:' + funcNames.join('|') + ')\\b[\\s\\S]+?\\n\\1}', 'gm'));
    _.each(snippets, function(snippet) {
      var modified = snippet;
      _.each(props, function(prop, index) {
        var minName = minNames[index],
            reBracketProp = RegExp("\\['(" + prop + ")'\\]", 'g'),
            reDotProp = RegExp('\\.' + prop + '\\b', 'g'),
            rePropColon = RegExp("([^?\\s])\\s*([\"'])?\\b" + prop + "\\2\\s*:", 'g');

        modified = modified
          .replace(reBracketProp, "['" + minName + "']")
          .replace(reDotProp, "['" + minName + "']")
          .replace(rePropColon, "$1'" + minName + "':");
      });

      // Replace with modified snippet.
      source = source.replace(snippet, function() {
        return modified;
      });
    });
  }());

  // Add brackets to whitelisted properties so the Closure Compiler won't mung them.
  // See http://code.google.com/closure/compiler/docs/api-tutorial3.html#export.
  return source.replace(RegExp('(["\'])(?:(?!\\1)[^\\n\\\\]|\\\\.)*\\1|\\.(' + propWhitelist.join('|') + ')\\b', 'g'), function(match, quote, prop) {
    return quote ? match : "['" + prop + "']";
  });
}

/*----------------------------------------------------------------------------*/

// Export `preprocess`.
if (module != require.main) {
  module.exports = preprocess;
}
// Read the lodash source file from the first argument if the script was invoked
// by the command-line (e.g. `node pre-compile.js source.js`) and write to the same file.
else if (_.size(process.argv) > 2) {
  (function() {
    var filePath = path.normalize(_.last(process.argv)),
        isTemplate = _.includes(process.argv, '-t') || _.includes(process.argv, '--template'),
        source = fs.readFileSync(filePath, 'utf8');

    fs.writeFileSync(filePath, preprocess(source, {
      'isTemplate': isTemplate
    }), 'utf8');
  }());
}
