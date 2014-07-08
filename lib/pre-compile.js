'use strict';

/** Load Node.js modules */
var fs = require('fs');

/** Load other modules */
var _ = require('lodash/lodash.js');

/** Used to minify variables and string values to a single character */
var minNames = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
minNames.push.apply(minNames, minNames.map(function(value) {
  return value + value;
}));

/** Used to protect the specified properties from getting minified */
var propWhitelist = _.union(
  _.keys(_),
  _.keys(_.prototype),
  _.keys(_.support),
  _.keys(_.templateSettings), [
  'BYTES_PER_ELEMENT',
  'Array',
  'ArrayBuffer',
  'Boolean',
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
  'WinRTError',
  '__chain__',
  '__wrapped__',
  'add',
  'amd',
  'buffer',
  'byteLength',
  'cache',
  'cancel',
  'clearTimeout',
  'configurable',
  'createDocumentFragment',
  'criteria',
  'document',
  'enumerable',
  'exports',
  'global',
  'index',
  'leading',
  'length',
  'maxWait',
  'name',
  'nodeType',
  'omission',
  'self',
  'separator',
  'set',
  'setImmediate',
  'setTimeout',
  'source',
  'trailing',
  'value',
  'window',
  'writable'
]);

/*----------------------------------------------------------------------------*/

/**
 * Pre-process a given Lo-Dash `source`, preparing it for minification.
 *
 * @param {string} [source=''] The source to process.
 * @param {Object} [options={}] The options object.
 * @returns {string} Returns the processed source.
 */
function preprocess(source, options) {
  source || (source = '');
  options || (options = {});

  // remove unrecognized JSDoc tags so the Closure Compiler won't complain
  source = source.replace(/@(?:alias|category)\b.*/g, '');

  if (options.isTemplate) {
    return source;
  }
  // remove whitespace from `_.template` related regexes
  source = source.replace(/reEmptyString\w+ *=.+/g, function(match) {
    return match.replace(/ |\\n/g, '');
  });

  // remove whitespace from `_.template`
  source = source.replace(/^( *)function template\b[\s\S]+?\n\1}/m, function(snippet) {
    // remove whitespace from string literals
    snippet = snippet.replace(/^((?:[ "'$\w]+:)? *)"[^"\n\\]*?(?:\\.[^"\n\\]*?)*"|'[^'\n\\]*?(?:\\.[^'\n\\]*?)*'/gm, function(string, left) {
      // clip after an object literal property name or leading spaces
      if (left) {
        string = string.slice(left.length);
      }
      // avoids removing the '\n' of the `stringEscapes` object
      string = string.replace(/\[object |delete |else (?!{)|function | in | instanceof |return\s+["'$\w]|throw |typeof |use strict|var |# |(["'])(?:\\n| )\1|\\\\n|\\n|\s+/g, function(match) {
        return match == false || match == '\\n' ? '' : match;
      });
      // unclip
      return (left || '') + string;
    });

    // remove newline from double-quoted strings
    snippet = snippet
      .replace('"__p += \'"', '"__p+=\'"')
      .replace('"\';\\n"', '"\';"');

    // add a newline back so "evaluate" delimiters can support single line comments
    snippet = snippet.replace('";__p+=\'"', '";\\n__p+=\'"');

    // remove `sourceURL` value from `_.template`
    return snippet
      .replace(/^ *(?:var )?sourceURL *=[^;]+;\n+/gm, '')
      .replace(/ *\+ *sourceURL(?=\))/, '');
  });

  // minify internal properties
  (function() {
    var funcNames = [
      'compareAscending',
      'compareMultipleAscending',
      'sortBy'
    ];

    var props = [
      'criteria',
      'index',
      'value'
    ];

    // minify properties used in `funcNames` functions
    var snippets = source.match(RegExp('^( *)(?:var|function) +(?:' + funcNames.join('|') + ')\\b[\\s\\S]+?\\n\\1}', 'gm'));
    _.each(snippets, function(snippet) {
      var modified = snippet;
      _.each(props, function(prop, index) {
        var minName = minNames[index],
            reBracketProp = RegExp("\\['(" + prop + ")'\\]", 'g'),
            reDotProp = RegExp('\\.' + prop + '\\b', 'g'),
            rePropColon = RegExp("([^?\\s])\\s*([\"'])?\\b" + prop + "\\2 *:", 'g');

        modified = modified
          .replace(reBracketProp, "['" + minName + "']")
          .replace(reDotProp, "['" + minName + "']")
          .replace(rePropColon, "$1'" + minName + "':");
      });

      // replace with modified snippet
      source = source.replace(snippet, function() {
        return modified;
      });
    });
  }());

  // add brackets to whitelisted properties so the Closure Compiler won't mung them
  // http://code.google.com/closure/compiler/docs/api-tutorial3.html#export
  return source.replace(RegExp('(["\'])(?:(?!\\1)[^\\n\\\\]|\\\\.)*\\1|\\.(' + propWhitelist.join('|') + ')\\b', 'g'), function(match, quote, prop) {
    return quote ? match : "['" + prop + "']";
  });
}

/*----------------------------------------------------------------------------*/

// export `preprocess`
if (module != require.main) {
  module.exports = preprocess;
}
// read the Lo-Dash source file from the first argument if the script
// was invoked directly (e.g. `node pre-compile.js source.js`) and write to
// the same file
else if (_.size(process.argv) > 2) {
  (function() {
    var filePath = path.normalize(_.last(process.argv)),
        isTemplate = _.contains(process.argv, '-t') || _.contains(process.argv, '--template'),
        source = fs.readFileSync(filePath, 'utf8');

    fs.writeFileSync(filePath, preprocess(source, {
      'isTemplate': isTemplate
    }), 'utf8');
  }());
}
