'use strict';

var _ = require('lodash');

/** The minimal copyright header template. */
var headerTemplate = [
  '/**',
  ' * @license',
  ' * Lodash lodash.com/license | Underscore.js <%= underscore.VERSION %> underscorejs.org/LICENSE',
  ' */'
].join('\n');

/*----------------------------------------------------------------------------*/

/**
 * Post-process `source` to prepare it for deployment.
 *
 * @param {string} source The source to process.
 * @param {boolean} [isMapped] Specify whether `source` has a source map.
 * @returns {string} Returns the processed source.
 */
function postprocess(source, isMapped) {
  // Add trailing semicolon.
  source = source.replace(/[\s;]*(\n\s*\/\/.*)?\s*$/, ';$1');

  // Exit early if `source` has a source map.
  if (isMapped) {
    return source;
  }
  // Remove copyright header.
  var header = _.get(/^\/\**[\s\S]+?\*\/\n/.exec(source), 0, '');
  source = source.replace(header, '');

  // Add new copyright header.
  source = _.template(headerTemplate)({
    'underscore': { 'VERSION': _.get(/\bUnderscore\.js ([.$\w\-]+)/i.exec(header), 1, '') }
  }) + '\n;' + source;

  // Replace `!0` and `!1` with `true` and `false`.
  source = source.replace(/(.)(\![01])\b/g, function(match, chr, exp) {
    return chr + (/[$\w]/.test(chr) ? ' ' : '') + (exp == '!0');
  });

  // Flip `typeof` expressions to help optimize Safari and
  // correct the AMD module definition for AMD build optimizers
  // (e.g. from `"number" == typeof x` to `typeof x == "number").
  source = source.replace(/([$\w])?("[^"]+")\s*([!=]=)\s*(typeof(?:\s*\([^)]+\)|\s+[$\w]+(?:\s*\.\s*[$\w]+)*([[(])?))/g, function(match, left, type, equality, exp, right) {
    return right ? match : (left ? left + ' ' : '') + exp + equality + type;
  });

  // Add a space so `define` is detected by the Dojo builder.
  source = source.replace(/(.)(define\()/, function(match, prelude, define) {
    return prelude + (/^\S/.test(prelude) ? ' ' : '') +  define;
  });

  // Consolidate multiple newlines.
  return source.replace(/\n{2,}/g, '\n');
}

module.exports = postprocess;
