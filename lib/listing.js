'use strict';

/** Load other modules. */
var _ = require('lodash'),
    mapping = require('./mapping.js');

/** Native method references. */
var push = Array.prototype.push;

/*----------------------------------------------------------------------------*/

/** List of all object property dependencies. */
exports.objDeps = _.uniq(_.transform(mapping.objDep, _.bind(push.apply, push), [])).sort();

/** List of all variable dependencies. */
exports.varDeps = _.uniq(_.transform(mapping.varDep, _.bind(push.apply, push), [])).sort();

/** List of all functions. */
exports.funcs = _.filter(_.difference(_.keys(mapping.funcDep), exports.objDeps, exports.varDeps).sort(), function(key) {
  var type = typeof _.prototype[key];
  return type == 'function' || type == 'undefined';
});

/** List of lodash functions included by default. */
exports.includes = _.intersection(exports.funcs, _.union(
  _.functions(_),
  _.functions(_.prototype),
  mapping.category.Seq,
  ['main']
));

_.assign(module.exports, {

  /** List of all function categories. */
  'categories': _.keys(mapping.category).sort(),

  /** List of variables with complex assignments. */
  'complexVars': [
    'cloneableTags',
    'reComplexWord',
    'typedArrayTags'
  ],

  /** List of functions included in the "core" build. */
  'coreFuncs': [
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
    'first',
    'flatten',
    'flattenDeep',
    'forEach',
    'has',
    'head',
    'identity',
    'indexOf',
    'invokeMap',
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
    'max',
    'min',
    'mixin',
    'negate',
    'noConflict',
    'noop',
    'now',
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
  ],

  /** List of the default ways to export the `lodash` function. */
  'exports': [
    'amd',
    'global',
    'iojs',
    'node',
    'umd'
  ],

  /** List of dependencies that should not cause a minor bump when changed. */
  'laxSemVerDeps': [
    'eq',
    'gt',
    'gte',
    'isArguments',
    'isArray',
    'isArrayLike',
    'isArrayLikeObject',
    'isBoolean',
    'isDate',
    'isElement',
    'isError',
    'isFinite',
    'isFunction',
    'isInteger',
    'isLength',
    'isNaN',
    'isNative',
    'isNil',
    'isNull',
    'isNumber',
    'isObject',
    'isObjectLike',
    'isRegExp',
    'isSafeInteger',
    'isString',
    'isSymbol',
    'isTypedArray',
    'isUndefined',
    'lt',
    'lte',
    'toString'
  ],

  /** List of functions that support argument placeholders. */
  'placeholderFuncs': [
    'bind',
    'bindKey',
    'curry',
    'curryRight',
    'partial',
    'partialRight'
  ],

  /* Used to designate dependencies at the top level. */
  'topLevelDeps': [
    'main'
  ],

  /** List of uninlinable dependencies. */
  'uninlinables': _.union(
    _.without(exports.includes,
      'clamp',
      'constant',
      'drop',
      'dropRight',
      'eq',
      'filter',
      'gt',
      'gte',
      'head',
      'identity',
      'isArguments',
      'isArray',
      'isArrayLike',
      'isArrayLikeObject',
      'isBoolean',
      'isDate',
      'isElement',
      'isError',
      'isFinite',
      'isFunction',
      'isInteger',
      'isLength',
      'isNaN',
      'isNative',
      'isNil',
      'isNull',
      'isNumber',
      'isObject',
      'isObjectLike',
      'isRegExp',
      'isSafeInteger',
      'isString',
      'isSymbol',
      'isTypedArray',
      'isUndefined',
      'last',
      'lt',
      'lte',
      'matches',
      'noop',
      'now',
      'pluck',
      'property',
      'toInteger',
      'toNumber',
      'toPlainObject',
      'toSafeInteger',
      'toString',
      'values',
      'wrap'
    ),
    _.keys(_.templateSettings), [
    'arrayEach',
    'arrayFilter',
    'arrayIncludes',
    'arrayIncludesWith',
    'arrayMap',
    'baseDifferenceBy',
    'baseEach',
    'baseEachRight',
    'baseFilter',
    'baseFind',
    'baseFindIndex',
    'baseFlatten',
    'baseFor',
    'baseIntersectionBy',
    'baseIsEqual',
    'baseIsMatch',
    'basePullAt',
    'basePullAllBy',
    'baseReduce',
    'baseSet',
    'baseSlice',
    'baseSortedIndexBy',
    'baseSortedUniqBy',
    'baseUniqBy',
    'baseXorBy',
    'cacheHas',
    'charsEndIndex',
    'charsStartIndex',
    'createWrapper',
    'getNative',
    'MapCache',
    'SetCache',
    'Stack',
    'reInterpolate',
    'reEscape',
    'reEvaluate',
    'templateSettings'
  ]).sort()
});
