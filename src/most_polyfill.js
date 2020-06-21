module.exports = function most(arr, fun) {
  if (!Array.isArray(arr)) throw new TypeError('<arr> argument must be a valid array');
  if (typeof fun !== 'function') throw new TypeError('<fun> argument must be a function');

  const len = arr.length >>> 0;
  const extent = Math.round(len / 2);
  let count = 0;

  // non-exhaustive iteration: check enough items to qualify this call
  for (let index = 0; index < len; index += 1) {
    const item = arr[index];
    if (fun.call(null, item, index, arr)) count += 1;
    if (count === extent) return true;
  }

  return false;
};
