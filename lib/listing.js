'use strict';

/** Load other modules. */
var _ = require('lodash-compat'),
    mapping = require('./mapping.js'),
    util = require('./util.js');

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
    'contextProps',
    'ctorByTag',
    'freeGlobal',
    'nonEnumProps',
    'reWords',
    'shadowProps',
    'support',
    'typedArrayTags',
    'whitespace'
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
    'isArrayLike',
    'isBoolean',
    'isError',
    'isFinite',
    'isFunction',
    'isNaN',
    'isNull',
    'isNumber',
    'isObject',
    'isObjectLike',
    'isString',
    'isUndefined'
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
    'main',
    'support'
  ],

  /** List of uninlinable dependencies. */
  'uninlinables': _.union(
    _.without(exports.includes,
      'constant',
      'drop',
      'dropRight',
      'escapeRegExp',
      'filter',
      'identity',
      'isObject',
      'last',
      'matches',
      'noop',
      'now',
      'pluck',
      'property',
      'values'
    ),
    _.keys(_.support),
    _.keys(_.templateSettings), [
    'arrayCopy',
    'arrayEach',
    'arrayEvery',
    'arrayFilter',
    'arrayMap',
    'arrayMax',
    'arrayMin',
    'baseAssign',
    'baseAt',
    'baseCallback',
    'baseClone',
    'baseCompareAscending',
    'baseCopy',
    'baseCreate',
    'baseDelay',
    'baseDifference',
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
    'baseIsEqual',
    'baseIsMatch',
    'baseMatches',
    'baseMatchesProperty',
    'basePullAt',
    'baseRandom',
    'baseReduce',
    'baseSlice',
    'baseSortBy',
    'baseSortByOrder',
    'baseToString',
    'baseUniq',
    'baseValues',
    'binaryIndex',
    'binaryIndexBy',
    'bindCallback',
    'cacheIndexOf',
    'charsLeftIndex',
    'charsRightIndex',
    'createAggregator',
    'createAssigner',
    'createCache',
    'createCompounder',
    'createPadding',
    'createWrapper',
    'getNative',
    'invokePath',
    'isIterateeCall',
    'pickByArray',
    'pickByCallback',
    'reInterpolate',
    'reEscape',
    'reEvaluate',
    'replaceHolders',
    'templateSettings',
    'toIterable',
    'toPath',
    'trimmedLeftIndex',
    'trimmedRightIndex'
  ]).sort()
});
