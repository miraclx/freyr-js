class ParseError extends Error {}

/**
 * Parse ranges in strings.
 * Syntax: `[a][..[=][b]]`
 * @param {string} spec
 * @example (valid) `a`, `a..`, `..b`, `a..b`, `a..=`, `..=b`, `a..=b`
 * @example (optional) ``, `..`, `..=`
 * @returns {{min: string; max: string; inclusive: boolean; strict: boolean;}}
 * - `min`: The minimum part of the range. E.g `5` in `5..10`
 * - `max`: The maximum part of the range. E.g `10` in `5..10`
 * - `inclusive`: Whether or not the maximum is a part of the range. E.g `true` in `5..=10`
 * - `strict`: Whether or not the spec was not a range. E.g `true` in `7`
 */
function parseRange(spec) {
  let [min, max] = [];
  const sepIndex = spec.indexOf('..');
  [min, max] = (~sepIndex ? [spec.slice(0, sepIndex), spec.slice(sepIndex + 2)] : [spec]).map(part => part.trim());
  let inclusive = !!max && max.startsWith('=');
  [min, max] = [min, inclusive ? (max ? max.slice(1) : min) : max].map(part => part || undefined);
  const strict = !~sepIndex;
  if (strict && !max) [max, inclusive] = [min, true];
  return {min, max, inclusive, strict};
}

/**
 * Parse a number-typed range
 * @param {*} spec
 * @param {*} strictSyntax Whether or not to throw on invalid parts
 * @example (valid) `1`, `1..`, `..5`, `1..5`, `1..=`, `..=5`, `1..=5`
 */
parseRange.num = function parseNumRange(spec, strictSyntax = false) {
  let {min, max, inclusive} = parseRange(spec);
  [min = -Infinity, max = Infinity, inclusive = inclusive] = [min, max].map(part => part && parseInt(part, 10));
  if (strictSyntax && [min, max].some(Number.isNaN)) throw new ParseError(`Invalid num range spec syntax \`${spec}\``);
  return {parsed: {min, max, inclusive}, check: num => num >= min && (inclusive ? num <= max : num < max)};
};

/**
 * Parse a duration oriented range
 * @param {*} spec
 * @param {*} strictSyntax Whether or not to throw on invalid parts
 * @example (valid) `1s`, `00:30..`, `..3:40`, `20..1:25`, `1s..=60000ms`, `..=200s`, `2:30..=310000ms`
 */
parseRange.time = function parseTimeRange(spec, strictSyntax = false) {
  const cast = val =>
    val !== undefined
      ? val.includes(':')
        ? val.split(':').reduce((acc, time) => 60 * acc + +time) * 1000
        : val.endsWith('h')
        ? parseInt(val.slice(0, -1), 10) * 3600000
        : val.endsWith('m')
        ? parseInt(val.slice(0, -1), 10) * 60000
        : val.endsWith('ms')
        ? parseInt(val.slice(0, -2), 10)
        : val.endsWith('s')
        ? parseInt(val.slice(0, -1), 10) * 1000
        : parseInt(val, 10) * 1000
      : val;
  let {min, max, inclusive} = parseRange(spec);
  [min = -Infinity, max = Infinity, inclusive = inclusive] = [min, max].map(cast);
  if (strictSyntax && [min, max].some(Number.isNaN)) throw new ParseError(`Invalid time range spec syntax \`${spec}\``);
  return {parsed: {min, max, inclusive}, check: time => time >= min && (inclusive ? time <= max : time < max)};
};

function initTest() {
  function test_num(spec, values) {
    console.log('%j', spec);
    const parseBlock = parseRange.num(spec);
    console.log(parseBlock.parsed);
    values.forEach(value => console.log(`[${value.toString().padStart(2)}] ${parseBlock.check(value)}`));
  }
  function test_time(spec, values) {
    console.log('%j', spec);
    const parseBlock = parseRange.time(spec);
    console.log(parseBlock.parsed);
    values.forEach(value => console.log(`[${value.toString().padStart(2)}] ${parseBlock.check(value)}`));
  }

  test_num('     ', [1, 2, 3]);
  test_num('7    ', [6, 7, 8]);
  test_num('..   ', [1, 2, 3]);
  test_num('..=  ', [4, 5, 6]);
  test_num('3..  ', [2, 3, 4]);
  test_num('..4  ', [3, 4, 5]);
  test_num('..=4 ', [3, 4, 5]);
  test_num('5..10', [4, 5, 9, 10, 11]);
  test_num('3..=9', [2, 3, 8, 9, 10]);
  // invalids
  test_num('a..b ', [1, 2, 3]);
  test_num('...  ', [1, 2, 3]);
  test_num('...=9', [8, 9, 10]);

  test_time('3:30..3:35 ', [209999, 210000, 214999, 215000, 215001]);
  test_time('3s..9s     ', [2999, 3000, 8999, 9000, 9001]);
  test_time('10s..=00:30', [9999, 10000, 29999, 30000, 30001]);
  test_time('20..50s    ', [19999, 20000, 49999, 50000, 50001]);
}

module.exports = parseRange;
if (require.main === module) initTest();
