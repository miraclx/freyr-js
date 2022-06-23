/* eslint-disable no-restricted-syntax */

export default function walk(object, ...keys) {
  return keys.flat().reduce((base, key) => {
    if (Array.isArray(base) && typeof key !== 'number') {
      for (const obj of base) {
        const result = walk(obj, key);
        if (result != null) return result;
      }
    } else if (typeof base === 'object' && base !== null) {
      if (key in base && base[key] != null) return base[key];
      for (const value of Object.values(base)) {
        const result = walk(value, key);
        if (result != null) return result;
      }
    }
    return null;
  }, object);
}
