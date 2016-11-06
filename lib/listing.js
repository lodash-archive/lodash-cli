'use strict';

var _ = require('lodash'),
    mapping = require('./mapping'),
    util = require('./util'),
    Hash = util.Hash;

/*----------------------------------------------------------------------------*/

/** List of all function property dependencies. */
exports.funcDeps = _.uniq(_.flatMap(mapping.funcDep)).sort();

/** List of all variable dependencies. */
exports.varDeps = _.uniq(_.flatMap(mapping.varDep)).sort();

/** List of `exports` options. */
exports.buildExports = new Hash({
  'all': [
    'amd',
    'es',
    'global',
    'node',
    'npm',
    'umd'
  ],
  'defaults': {
    'modularize': [
      'node'
    ],
    'monolithic': [
      'amd',
      'global',
      'node',
      'umd'
    ]
  },
  'modularize': [
    'amd',
    'es',
    'node',
    'npm'
  ],
  'monolithic': [
    'amd',
    'global',
    'node',
    'umd'
  ],
  'umd': [
    'amd',
    'global',
    'node'
  ]
});

/** List of build flags. */
exports.buildFlags = [
  'core',
  'modularize',
  'strict',
  '-c', '--stdout',
  '-d', '--development',
  '-h', '--help',
  '-m', '--source-map',
  '-o', '--output',
  '-p', '--production',
  '-s', '--silent',
  '-V', '--version'
];

/** List of ES3 built-ins. */
exports.builtins = [
  'Array',
  'Boolean',
  'Date',
  'Error',
  'EvalError',
  'Function',
  'Math',
  'Object',
  'RangeError',
  'ReferenceError',
  'RegExp',
  'String',
  'SyntaxError',
  'TypeError',
  'URIEror'
];

/** List of all function categories. */
exports.categories = _.keys(mapping.category).sort();

/** List of variables with complex assignments. */
exports.complexVars = [
  'cloneableTags',
  'maskSrcKey',
  'nodeUtil',
  'reComplexWord',
  'typedArrayTags'
];

/** List of functions included in the "core" build. */
exports.coreFuncs = [
  'assignIn',
  'before',
  'bind',
  'chain',
  'clone',
  'compact',
  'concat',
  'create',
  'defaults',
  'defer',
  'delay',
  'escape',
  'every',
  'filter',
  'find',
  'flatten',
  'flattenDeep',
  'forEach',
  'has',
  'head',
  'identity',
  'indexOf',
  'isArguments',
  'isArray',
  'isBoolean',
  'isDate',
  'isEmpty',
  'isEqual',
  'isFinite',
  'isFunction',
  'isNaN',
  'isNull',
  'isNumber',
  'isObject',
  'isRegExp',
  'isString',
  'isUndefined',
  'iteratee',
  'keys',
  'last',
  'map',
  'matches',
  'max',
  'min',
  'mixin',
  'negate',
  'noConflict',
  'noop',
  'once',
  'pick',
  'reduce',
  'result',
  'size',
  'slice',
  'some',
  'sortBy',
  'tap',
  'thru',
  'toArray',
  'uniqueId',
  'value',
  'values'
];

/** List of all functions. */
exports.funcs = _.filter(_.difference(_.keys(mapping.funcDep), exports.varDeps).sort(), function(key) {
  var type = typeof _.prototype[key];
  return type == 'function' || type == 'undefined';
});

/** List of lodash functions included by default. */
exports.includes = _.intersection(exports.funcs, _.concat(
  _.functions(_),
  _.functions(_.prototype),
  mapping.category.Seq,
  ['main']
));

/** List of dependencies that should not cause a minor bump when changed. */
exports.laxSemVerDeps = [
  'eq',
  'gt',
  'gte',
  'isArguments',
  'isArray',
  'isArrayBuffer',
  'isArrayLike',
  'isArrayLikeObject',
  'isBoolean',
  'isBuffer',
  'isDate',
  'isElement',
  'isError',
  'isFinite',
  'isFunction',
  'isInteger',
  'isLength',
  'isMap',
  'isNaN',
  'isNative',
  'isNil',
  'isNull',
  'isNumber',
  'isObject',
  'isObjectLike',
  'isRegExp',
  'isSafeInteger',
  'isSet',
  'isString',
  'isSymbol',
  'isTypedArray',
  'isUndefined',
  'isWeakMap',
  'isWeakSet',
  'lt',
  'lte',
  'root',
  'toInteger',
  'toLength',
  'toNumber',
  'toSafeInteger',
  'toString'
];

/** List of properties to escape from minification. */
exports.minifyEscapes = _.union(
  _.keys(_),
  _.keys(_.prototype),
  _.keys(_.templateSettings), [
  'IE_PROTO',
  'NEGATIVE_INFINITY',
  'POSITIVE_INFINITY',
  'Array',
  'ArrayBuffer',
  'Boolean',
  'Buffer',
  'Cache',
  'Date',
  'Error',
  'Float32Array',
  'Float64Array',
  'Function',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Map',
  'Math',
  'Number',
  'Object',
  'Promise',
  'Reflect',
  'RegExp',
  'Set',
  'String',
  'Symbol',
  'TypeError',
  'Uint8Array',
  'Uint8ClampedArray',
  'Uint16Array',
  'Uint32Array',
  'WeakMap',
  'WeakSet',
  'WinRTError',
  '__actions__',
  '__chain__',
  '__data__',
  '__dir__',
  '__filtered__',
  '__index__',
  '__iteratees__',
  '__takeCount__',
  '__values__',
  '__views__',
  '__wrapped__',
  'add',
  'amd',
  'args',
  'binding',
  'buffer',
  'byteLength',
  'cache',
  'cancel',
  'clear',
  'clearTimeout',
  'configurable',
  'copy',
  'count',
  'criteria',
  'delete',
  'document',
  'done',
  'end',
  'enumerable',
  'exports',
  'flush',
  'func',
  'get',
  'global',
  'has',
  'hash',
  'index',
  'isConcatSpreadable',
  'iteratee',
  'iterator',
  'leading',
  'length',
  'limit',
  'map',
  'maxWait',
  'message',
  'name',
  'next',
  'nodeType',
  'omission',
  'parseFloat',
  'placeholder',
  'process',
  'self',
  'separator',
  'set',
  'setTimeout',
  'size',
  'source',
  'sourceURL',
  'start',
  'string',
  'thisArg',
  'trailing',
  'type',
  'value',
  'window',
  'writable'
]);

/** List of functions that support argument placeholders. */
exports.placeholderFuncs = [
  'bind',
  'bindKey',
  'curry',
  'curryRight',
  'partial',
  'partialRight'
];

/* Used to designate dependencies at the top level. */
exports.topLevelDeps = [
  'main'
];

/** List of uninlinable dependencies. */
exports.uninlinables = [
  'reInterpolate',
  'templateSettings'
];
