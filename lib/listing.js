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
  mapping.category.Chain,
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
    'before',
    'bind',
    'chain',
    'clone',
    'compact',
    'create',
    'defaults',
    'defer',
    'delay',
    'escape',
    'every',
    'extend',
    'filter',
    'find',
    'first',
    'flatten',
    'flattenDeep',
    'forEach',
    'functions',
    'has',
    'identity',
    'indexOf',
    'invoke',
    'isArguments',
    'isArray',
    'isBoolean',
    'isDate',
    'isEmpty',
    'isEqual',
    'isError',
    'isFinite',
    'isFunction',
    'isNaN',
    'isNil',
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
    'commonjs',
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
    'isArray',
    'isArrayLike',
    'isArrayLikeObject',
    'isBoolean',
    'isDate',
    'isError',
    'isFinite',
    'isFunction',
    'isInteger',
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
      'filter',
      'gt',
      'gte',
      'head',
      'identity',
      'isArray',
      'isArrayLike',
      'isArrayLikeObject',
      'isObject',
      'isObjectLike',
      'isSafeInteger',
      'last',
      'lt',
      'lte',
      'matches',
      'noop',
      'now',
      'pluck',
      'property',
      'toInteger',
      'toPlainObject',
      'toSafeInteger',
      'values',
      'wrap'
    ),
    _.keys(_.templateSettings), [
    'arrayEach',
    'arrayEvery',
    'arrayFilter',
    'arrayMap',
    'baseAt',
    'baseCreate',
    'baseDelay',
    'baseDifferenceBy',
    'baseEach',
    'baseEachRight',
    'baseFilter',
    'baseFind',
    'baseFindIndex',
    'baseFlatten',
    'baseFor',
    'baseForRight',
    'baseFunctions',
    'baseGet',
    'baseIndexOf',
    'baseIntersectionBy',
    'baseIsEqual',
    'baseIsMatch',
    'baseIteratee',
    'baseMatches',
    'baseMatchesProperty',
    'basePick',
    'basePickBy',
    'basePullAt',
    'basePullAllBy',
    'baseRandom',
    'baseReduce',
    'baseSlice',
    'baseSortByOrder',
    'baseSortedUniqBy',
    'baseUniqBy',
    'baseValues',
    'baseXorBy',
    'binaryIndex',
    'binaryIndexBy',
    'cacheIndexOf',
    'charsLeftIndex',
    'charsRightIndex',
    'compareAscending',
    'copyArray',
    'copyObjectWith',
    'createAggregator',
    'createAssigner',
    'createCompounder',
    'createFlow',
    'createInvoker',
    'createModArgs',
    'createPadding',
    'createRound',
    'createWrapper',
    'getNative',
    'invokePath',
    'isIterateeCall',
    'MapCache',
    'SetCache',
    'Stack',
    'reInterpolate',
    'reEscape',
    'reEvaluate',
    'replaceHolders',
    'templateSettings',
    'trimmedLeftIndex',
    'trimmedRightIndex'
  ]).sort()
});
