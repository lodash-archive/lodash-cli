'use strict';

/** The text displayed for the `--help` option. */
exports.helpText = [
  'Usage:',
  '  lodash [commands] [options]',
  '',
  'Commands:',
  '',
  '  core         Create a 4 kB build',
  '  modularize   Create a build with lodash split into modules',
  '  strict       Create an ES strict mode enabled build',
  '',
  '  include=..   Comma separated function/category names to include in the build',
  '',
  '  minus=..     Comma separated function/category names to remove from the build',
  '',
  '  plus=..      Comma separated function/category names to add to the build',
  '',
  '  category=..  Comma separated categories of functions to include in the build',
  '               (i.e. “array”, “collection”, “date”, “function”, “lang”,',
  '               “object”, “number”, “seq”, “string”, & “util”)',
  '',
  '  exports=..   Comma separated values of ways to export lodash.',
  '               (i.e. “amd”, “es”, “global”, “node”, “none”, “npm”, & “umd”)',
  '',
  '  iife=..      Code to replace the IIFE that wraps lodash',
  '               (e.g. `lodash iife="\\!function(){%output%}()"`)',
  '',
  '  template=..  File path pattern used to match template files to precompile',
  '               (e.g. `lodash template=./*.jst`)',
  '',
  '  settings=..  Template settings used when precompiling templates',
  '               (e.g. `lodash settings="{interpolate:/{{([\\s\\S]+?)}}/g}"`)',
  '',
  '  moduleId=..  The AMD module ID used to export lodash in lodash builds or',
  '               the module ID used to include lodash in compiled templates.',
  '',
  '               Use “none” as the module ID to create compiled templates without',
  '               a dependency on lodash.',
  '',
  '  The `exports` values “es” & “npm” may only be used in conjunction with',
  '  the `modularize` command.',
  '',
  '  The `modularize` command uses the first `exports` values as its module format,',
  '  ignoring subsequent values.',
  '',
  '  Unless specified by `-o` or `--output` all files created are saved to the',
  '  current working directory.',
  '',
  'Options:',
  '',
  '  -c, --stdout       Write output to standard output',
  '  -d, --development  Write only the non-minified development output',
  '  -h, --help         Display help information',
  '  -m, --source-map   Generate a source map using an optional source map URL',
  '  -o, --output       Write output to a given path/filename',
  '  -p, --production   Write only the minified production output',
  '  -s, --silent       Skip status updates normally logged to the console',
  '  -V, --version      Output current version of lodash',
  ''
].join('\n');

/** The source for a horizontal rule comment. */
exports.hr = '  /*----------------------------------------------------------------------------*/';

/** The regexes to match comments and string literals. */
exports.reComment = /^ *(?:\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\/|\/\/.*)\n/gm;
exports.reString = /(["'])(?:(?!\1)[^\n\\]|\\.)*?\1/g;

/** The regexes to detect if a string is a function snippet or a variable declaration snippet. */
exports.reIsFuncSnippet = /\bfunction\b|\b[a-z]+(?:[A-Z][a-z]+)+\(|\broot\.(?:[A-Z][a-z0-9]+)+\b/;
exports.reIsVarSnippet = /^\s*var\s+/;

/** The regexes to match function and string tokens. */
exports.reCommentToken = /<#com_token\d+#>\n/g;
exports.reNamedToken = /,\s+<<[$\w]+>>|<<[$\w]+>>(?:,\s+|\n)?/g;
exports.reStringToken = /<#str_token\d+#>/g;

/** The regexp to match various calls and references. */
exports.reGetIteratee = /\bgetIteratee\b(?:\(\))?/g;

/** The regexp to determine if a variable search should be deep. */
exports.reHasDeepVars = /^ *function +runInContext\b/m;

/** The regexp to detect a function by its JSDoc tags. */
exports.reHasFuncTags = /^ *\* *(?:@param|@returns|@type +Function)\b/im;

/** The regexp source to detect single and multi-line comment blocks. */
exports.rsComment = '(?: *(?:/\\*[^*]*\\*+(?:[^/][^*]*\\*+)*/|\/\/.*)\\n)*';
