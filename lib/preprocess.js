'use strict';

var _ = require('lodash'),
    listing = require('./listing'),
    minifyEscapes = listing.minifyEscapes;

/** Used to minify variables and string values to a single character. */
var minNames = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
_.each(minNames, function(value) { minNames.push(value + value); });

/*----------------------------------------------------------------------------*/

/**
 * Pre-process `source` to prepare it for minification.
 *
 * @param {string} [source=''] The source to process.
 * @param {Object} [options={}] The options object.
 * @returns {string} Returns the processed source.
 */
function preprocess(source, options) {
  source = _.toString(source);
  options = _.cloneDeep(options);

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
      'baseOrderBy',
      'baseSortBy',
      'compareMultiple',
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
            reDotProp = RegExp('\\.' + prop + '\\b', 'g'),
            rePropName = RegExp("'" + prop + "'", 'g');

        modified = modified
          .replace(rePropName, "'" + minName + "'")
          .replace(reDotProp, "['" + minName + "']");
      });

      // Replace with modified snippet.
      source = source.replace(snippet, function() {
        return modified;
      });
    });
  }());

  // Add brackets to escaped properties so the Closure Compiler won't mung them.
  // See http://code.google.com/closure/compiler/docs/api-tutorial3.html#export.
  return source.replace(RegExp('(["\'])(?:(?!\\1)[^\\n\\\\]|\\\\.)*\\1|\\.(' + minifyEscapes.join('|') + ')\\b', 'g'), function(match, quote, prop) {
    return quote ? match : "['" + prop + "']";
  });
}

module.exports = preprocess;
