/**
 * Stripout invalid characters, symbols and unnecessary spaces
 *
 * - this will converge all repetitive whitespace to a max of 1
 * - this will convert all strings to their lower case equivalents
 * - this will automatically remove all repetitions in the array
 *
 * @param {string[]} data An array of strings to be stripped
 *
 * @example
 * stripText([
 *   "$a$B$c$", "#A#b#C",
 *   "c O  n   V    e     R      g       E"
 * ]); // [ "abc", "c o n v e r g e" ]
 *
 * stripText([
 *   "Hello, World!",
 *   "Hey, I'm David, What's Up?"
 * ]); // [ "hello world", "hey im david whats up" ]
 */
function stripText(data) {
  return [
    ...new Set(
      data.reduce(
        (all, text) =>
          (text = text
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^\p{Letter} \p{Number}]/gu, ''))
            ? all.concat([text.replace(/\s{2,}/g, ' ').toLowerCase()])
            : all,
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
 *
 * // AND lookups
 * getWeight(
 *   ["jacob cane", "jessica cane"],
 *   ["cane"]
 * ); // 0
 *
 * getWeight(
 *   ["jacob cane", "jessica cane"],
 *   ["cane", "jessica", "jacob"]
 * ); // 100
 */
function getWeight(a, b) {
  return (
    ((b = b.join(' ').split(' ')), a.map(v => v.split(' ').every(p => b.includes(p))).filter(v => !!v).length / a.length) * 100
  );
}

export default {stripText, getWeight};
