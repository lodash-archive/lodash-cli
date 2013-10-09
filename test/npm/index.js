var forEach = require('lodash.foreach'),
    forOwn = require('lodash.forown'),
    isArray = require('lodash.isarray'),
    lodashWrapper = require('lodash._lodashwrapper'),
    mixin = require('lodash.mixin'),
    support = require('lodash.support'),
    templateSettings = require('lodash.templatesettings');

/** Used for `Array` method references */
var arrayRef = [];

/** Used for native method references */
var objectProto = Object.prototype;

/** Native method shortcuts */
var hasOwnProperty = objectProto.hasOwnProperty,
    push = arrayRef.push;

/**
 * Creates a `lodash` object which wraps the given value to enable method
 * chaining.
 *
 * @name _
 * @constructor
 * @category Chaining
 * @param {*} value The value to wrap in a `lodash` instance.
 * @returns {Object} Returns a `lodash` instance.
 */
function lodash(value) {
  // don't wrap if already wrapped, even if wrapped by a different `lodash` constructor
  return (value && typeof value == 'object' && !isArray(value) && hasOwnProperty.call(value, '__wrapped__'))
   ? value
   : new lodashWrapper(value);
}
// ensure `new lodashWrapper` is an instance of `lodash`
lodashWrapper.prototype = lodash.prototype;

// wrap `_.mixin` so it works when provided only one argument
mixin = (function(fn) {
  return function(object, source) {
    if (!source) {
      source = object;
      object = lodash;
    }
    return fn(object, source);
  };
}(mixin));

// add functions
lodash.after = require('lodash.after');
lodash.assign = require('lodash.assign');
lodash.at = require('lodash.at');
lodash.bind = require('lodash.bind');
lodash.bindAll = require('lodash.bindall');
lodash.bindKey = require('lodash.bindkey');
lodash.clone = require('lodash.clone');
lodash.cloneDeep = require('lodash.clonedeep');
lodash.compact = require('lodash.compact');
lodash.compose = require('lodash.compose');
lodash.contains = require('lodash.contains');
lodash.countBy = require('lodash.countby');
lodash.createCallback = require('lodash.createcallback');
lodash.curry = require('lodash.curry');
lodash.debounce = require('lodash.debounce');
lodash.defaults = require('lodash.defaults');
lodash.defer = require('lodash.defer');
lodash.delay = require('lodash.delay');
lodash.difference = require('lodash.difference');
lodash.escape = require('lodash.escape');
lodash.every = require('lodash.every');
lodash.filter = require('lodash.filter');
lodash.find = require('lodash.find');
lodash.findIndex = require('lodash.findindex');
lodash.findKey = require('lodash.findkey');
lodash.findLast = require('lodash.findlast');
lodash.findLastIndex = require('lodash.findlastindex');
lodash.findLastKey = require('lodash.findlastkey');
lodash.first = require('lodash.first');
lodash.flatten = require('lodash.flatten');
lodash.forEach = require('lodash.foreach');
lodash.forEachRight = require('lodash.foreachright');
lodash.forIn = require('lodash.forin');
lodash.forInRight = require('lodash.forinright');
lodash.forOwn = require('lodash.forown');
lodash.forOwnRight = require('lodash.forownright');
lodash.functions = require('lodash.functions');
lodash.groupBy = require('lodash.groupby');
lodash.has = require('lodash.has');
lodash.identity = require('lodash.identity');
lodash.indexBy = require('lodash.indexby');
lodash.indexOf = require('lodash.indexof');
lodash.initial = require('lodash.initial');
lodash.intersection = require('lodash.intersection');
lodash.invert = require('lodash.invert');
lodash.invoke = require('lodash.invoke');
lodash.isArguments = require('lodash.isarguments');
lodash.isArray = require('lodash.isarray');
lodash.isBoolean = require('lodash.isboolean');
lodash.isDate = require('lodash.isdate');
lodash.isElement = require('lodash.iselement');
lodash.isEmpty = require('lodash.isempty');
lodash.isEqual = require('lodash.isequal');
lodash.isFinite = require('lodash.isfinite');
lodash.isFunction = require('lodash.isfunction');
lodash.isNaN = require('lodash.isnan');
lodash.isNull = require('lodash.isnull');
lodash.isNumber = require('lodash.isnumber');
lodash.isObject = require('lodash.isobject');
lodash.isPlainObject = require('lodash.isplainobject');
lodash.isRegExp = require('lodash.isregexp');
lodash.isString = require('lodash.isstring');
lodash.isUndefined = require('lodash.isundefined');
lodash.keys = require('lodash.keys');
lodash.last = require('lodash.last');
lodash.lastIndexOf = require('lodash.lastindexof');
lodash.map = require('lodash.map');
lodash.max = require('lodash.max');
lodash.memoize = require('lodash.memoize');
lodash.merge = require('lodash.merge');
lodash.min = require('lodash.min');
lodash.mixin = require('lodash.mixin');
lodash.omit = require('lodash.omit');
lodash.once = require('lodash.once');
lodash.pairs = require('lodash.pairs');
lodash.parseInt = require('lodash.parseint');
lodash.partial = require('lodash.partial');
lodash.partialRight = require('lodash.partialright');
lodash.pick = require('lodash.pick');
lodash.pluck = require('lodash.pluck');
lodash.pull = require('lodash.pull');
lodash.random = require('lodash.random');
lodash.range = require('lodash.range');
lodash.reduce = require('lodash.reduce');
lodash.reduceRight = require('lodash.reduceright');
lodash.reject = require('lodash.reject');
lodash.remove = require('lodash.remove');
lodash.rest = require('lodash.rest');
lodash.result = require('lodash.result');
lodash.sample = require('lodash.sample');
lodash.shuffle = require('lodash.shuffle');
lodash.size = require('lodash.size');
lodash.some = require('lodash.some');
lodash.sortBy = require('lodash.sortby');
lodash.sortedIndex = require('lodash.sortedindex');
lodash.template = require('lodash.template');
lodash.throttle = require('lodash.throttle');
lodash.times = require('lodash.times');
lodash.toArray = require('lodash.toarray');
lodash.transform = require('lodash.transform');
lodash.unescape = require('lodash.unescape');
lodash.union = require('lodash.union');
lodash.uniq = require('lodash.uniq');
lodash.uniqueId = require('lodash.uniqueid');
lodash.values = require('lodash.values');
lodash.where = require('lodash.where');
lodash.without = require('lodash.without');
lodash.wrap = require('lodash.wrap');
lodash.zip = require('lodash.zip');
lodash.zipObject = require('lodash.zipobject');

// add aliases
lodash.all = lodash.every;
lodash.any = lodash.some;
lodash.collect = lodash.map;
lodash.detect = lodash.find;
lodash.drop = lodash.rest;
lodash.each = lodash.forEach;
lodash.eachRight = lodash.forEachRight;
lodash.extend = lodash.assign;
lodash.findWhere = lodash.find;
lodash.foldl = lodash.reduce;
lodash.foldr = lodash.reduceRight;
lodash.head = lodash.first;
lodash.include = lodash.contains;
lodash.inject = lodash.reduce;
lodash.methods = lodash.functions;
lodash.object = lodash.zipObject;
lodash.select = lodash.filter;
lodash.tail = lodash.rest;
lodash.take = lodash.first;
lodash.unique = lodash.uniq;
lodash.unzip = lodash.zip;

// add objects
lodash.support = support;
(lodash.templateSettings = templateSettings).imports._ = lodash;

module.exports = lodash;
