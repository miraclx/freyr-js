const {StripChar} = require('stripchar');

/**
 * Stripout invalid characters, symbols and unnecessary spaces
 * @param {string[]} data An array of strings to be stripped
 */
function stripText(data) {
  return [
    ...new Set(
      data.reduce(
        (all, text) => ((text = StripChar.RSspecChar(text)) ? all.concat([text.replace(/\s{2,}/g, ' ').toLowerCase()]) : all),
        [],
      ),
    ),
  ];
}

/**
 * What percentage of text found in `b` is in `a`
 * @param {string[]} a the base string to be searched in
 * @param {string[]} b the search query
 *
 * @example
 * let a = ["hello", "world", "are", "you", "happy"];
 * let b = ["hello", "dude", "how", "are", "you"];
 * // intersection = ["hello", "are", "you"];
 * // what percentage of `a` is the intersection
 * let c = getWeight(a, b); // 60
 */
function getWeight(a, b) {
  return (b = b.join(' ')), (a.filter(v => b.includes(v)).length / a.length) * 100;
}

module.exports = {stripText, getWeight};
