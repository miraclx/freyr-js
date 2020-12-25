/* eslint-disable no-restricted-syntax */

function walk(object, ...keys) {
  return keys.reduce((base, key) => {
    if (Array.isArray(base)) {
      for (const obj of base) {
        const result = walk(obj, key);
        if (result != null) return result;
      }
    } else if (typeof base === 'object') {
      if (key in base && base[key] != null) return base[key];
      for (const value of Object.values(base)) {
        const result = walk(value, key);
        if (result != null) return result;
      }
    }
    return null;
  }, object);
}

module.exports = walk;
