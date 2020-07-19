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
 */
parseRange.num = function parseNumRange(spec, strictSyntax = false) {
  let {min, max, inclusive} = parseRange(spec);
  [min = -Infinity, max = Infinity, inclusive = inclusive] = [min, max].map(part => part && parseInt(part, 10));
  if (strictSyntax && [min, max].some(Number.isNaN)) throw new ParseError(`Invalid num range spec syntax \`${spec}\``);
  return {parsed: {min, max, inclusive}, check: num => num >= min && (inclusive ? num <= max : num < max)};
};

function initTest() {
  function test(spec, values) {
    console.log('%j', spec);
    const parseBlock = parseRange.num(spec);
    console.log(parseBlock.parsed);
    values.forEach(value => console.log(`[${value.toString().padStart(2)}] ${parseBlock.check(value)}`));
  }

  test('     ', [1, 2, 3]);
  test('7    ', [6, 7, 8]);
  test('..   ', [1, 2, 3]);
  test('..=  ', [4, 5, 6]);
  test('3..  ', [2, 3, 4]);
  test('..4  ', [3, 4, 5]);
  test('..=4 ', [3, 4, 5]);
  test('5..10', [4, 5, 9, 10, 11]);
  test('3..=9', [2, 3, 8, 9, 10]);
  // invalids
  test('a..b ', [1, 2, 3]);
  test('...  ', [1, 2, 3]);
  test('...=9', [8, 9, 10]);
}

module.exports = parseRange;
if (require.main === module) initTest();
