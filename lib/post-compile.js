;(function() {
  'use strict';

  /** Load Node.js modules */
  var fs = require('fs');

  /** Load other modules */
  var _ = require('lodash/lodash.js');

  /** The minimal license/copyright template */
  var licenseTemplate = [
    '/**',
    ' * @license',
    ' * Lo-Dash <%= lodash.VERSION %> lodash.com/license | Underscore.js <%= underscore.VERSION %> underscorejs.org/LICENSE',
    ' */'
  ].join('\n');

  /*--------------------------------------------------------------------------*/

  /**
   * Post-process a given minified Lo-Dash `source`, preparing it for
   * deployment.
   *
   * @param {string} source The source to process.
   * @returns {string} Returns the processed source.
   */
  function postprocess(source) {
    // correct overly aggressive Closure Compiler advanced optimization
    source = source
      .replace(/\b(prototype\s*=\s*\{\s*valueOf\s*:\s*1)(\s*})/, '$1,y:1$2')
      .replace(/"\t"/g, '"\\t"')
      .replace(/"[^"]*?\\f[^"]*?"/g,
        '" \\t\\x0B\\f\\xa0\\ufeff' +
        '\\n\\r\\u2028\\u2029' +
        '\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000"'
      )
      .replace(/(try\s*\{\s*[$\w]+\s*\.\s*nodeClass\s*=\s*)(?:true|!0)\b/, function(match, prelude, index, source) {
        var documentVar = _.result(/([$\w]+)\s*=\s*([$\w]+)\s*&&\s*\2\s*\.\s*document\b/.exec(source), 1),
            objectClassVar = _.result(/([$\w]+)\s*=\s*"\[object Object\]"/.exec(source), 1),
            toStringVar = _.result(/([$\w]+)\s*=\s*[$\w]+\s*\.\s*toString\b/.exec(source), 1);

        return prelude + '!(' + toStringVar + '.call(' + documentVar + ')==' + objectClassVar + '&&!({toString:0}+""))';
      });

    // replace `!0` and `!1` with `true` and `false`
    source = source.replace(/(.)(\![01])\b/g, function(match, chr, exp) {
      return chr + (/[$\w]/.test(chr) ? ' ' : '') + (exp == '!0');
    });

    // flip `typeof` expressions to help optimize Safari and
    // correct the AMD module definition for AMD build optimizers
    // (e.g. from `"number" == typeof x` to `typeof x == "number")
    source = source.replace(/([$\w])?("[^"]+")\s*([!=]=)\s*(typeof(?:\s*\([^)]+\)|\s+[.$\w]+(?!\[)))/g, function(match, other, type, equality, exp) {
      return (other ? other + ' ' : '') + exp + equality + type;
    });

    // add a space so `define` is detected by the Dojo builder
    source = source.replace(/(.)(define\()/, function(match, prelude, define) {
      return prelude + (/^\S/.test(prelude) ? ' ' : '') +  define;
    });

    // add trailing semicolon
    if (source) {
      source = source.replace(/[\s;]*?(\s*\/\/.*\s*|\s*\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\/\s*)*$/, ';$1');
    }
    // remove copyright header
    var header = _.result(/^\/\**[\s\S]+?\*\/\n/.exec(source), 0, '');
    source = source.replace(header, '');

    // add new copyright header
    source = _.template(licenseTemplate, {
      'lodash': _,
      'underscore': { 'VERSION': _.result(/Underscore\.js ([\d.]+)/i.exec(header), 1, '') }
    }) + '\n;' + source;

    return source;
  }

  /*--------------------------------------------------------------------------*/

  // export `postprocess`
  if (module != require.main) {
    module.exports = postprocess;
  }
  else {
    // read the Lo-Dash source file from the first argument if the script
    // was invoked directly (e.g. `node post-compile.js source.js`) and write to
    // the same file
    (function() {
      var options = process.argv;
      if (_.size(options) < 3) {
        return;
      }
      var filePath = _.last(options),
          source = fs.readFileSync(filePath, 'utf8');

      fs.writeFileSync(filePath, postprocess(source), 'utf8');
    }());
  }
}());
