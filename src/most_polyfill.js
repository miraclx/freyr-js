module.exports = function most(arr, fun) {
  if (!Array.isArray(arr)) throw new TypeError('<arr> argument must be a valid array');
  if (typeof fun !== 'function') throw new TypeError('<fun> argument must be a function');

  const len = arr.length >>> 0;
  const extent = Math.round(len / 2);
  let count = 0;

  // eslint-disable-next-line no-restricted-syntax
  for (const [i, v] of Object.entries(arr)) {
    if (fun.call(null, v, i, arr)) count += 1;
    if (count === extent) return true;
  }

  return false;
};
