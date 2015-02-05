'use strict';

/** Load Node.js modules. */
var fs = require('fs');

/** Load other modules. */
var _ = require('lodash-compat');

/** The minimal license/copyright template. */
var licenseTemplate = [
  '/**',
  ' * @license',
  ' * lodash <%= lodash.VERSION %> lodash.com/license | Underscore.js <%= underscore.VERSION %> underscorejs.org/LICENSE',
  ' */'
].join('\n');

/*----------------------------------------------------------------------------*/

/**
 * Post-process a given minified lodash `source`, preparing it for
 * deployment.
 *
 * @param {string} source The source to process.
 * @returns {string} Returns the processed source.
 */
function postprocess(source) {
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

  // Add trailing semicolon.
  if (source) {
    source = source.replace(/[\s;]*?(\s*\/\/.*\s*|\s*\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\/\s*)*$/, ';$1');
  }
  // Correct overly aggressive Closure Compiler advanced optimizations.
  source = source
    .replace(/\b(prototype\s*=\s*\{\s*valueOf\s*:\s*1)(\s*})/, '$1,y:1$2')
    .replace(/"\t"/g, '"\\t"')
    .replace(/"[^"]*?\\f[^"]*?"/g,
      '" \\t\\x0b\\f\\xa0\\ufeff' +
      '\\n\\r\\u2028\\u2029' +
      '\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000"'
    )
    .replace(/(try\s*\{\s*)(?:([$\w]+)\([^)]+\))?(?=\s*\}\s*catch\b)/, function(match, prelude, Ctor) {
      return prelude + (Ctor || 'Object') + '({toString:0}+"")';
    })
    .replace(/\{\s*(?=return\s+function\s*\(\s*[$\w]+\s*\)\s*\{\s*return\s+typeof\s+[$\w]+\s*\.\s*toString\b)/, function(match) {
      return match + 'try{Object({toString:0}+"")}catch(n){return function(){return false}}';
    });

  // Remove copyright header.
  var header = _.result(/^\/\**[\s\S]+?\*\/\n/.exec(source), 0, '');
  source = source.replace(header, '');

  // Add new copyright header.
  source = _.template(licenseTemplate)({
    'lodash': _,
    'underscore': { 'VERSION': _.result(/\bUnderscore\.js ([.$\w\-]+)/i.exec(header), 1, '') }
  }) + '\n;' + source;

  return source;
}

/*----------------------------------------------------------------------------*/

// Export `postprocess`.
if (module != require.main) {
  module.exports = postprocess;
}
// Read the lodash source file from the first argument if the script was invoked
// by the command-line (e.g. `node post-compile.js source.js`) and write to the same file.
else if (_.size(process.argv) > 2) {
  (function() {
    var filePath = path.normalize(_.last(process.argv)),
        source = fs.readFileSync(filePath, 'utf8');

    fs.writeFileSync(filePath, postprocess(source), 'utf8');
  }());
}
