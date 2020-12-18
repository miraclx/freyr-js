function walk(object, key) {
  if (Array.isArray(object)) {
    for (const obj of object) {
      const result = walk(obj, key);
      if (result != null) return result;
    }
  } else if (typeof object === 'object') {
    if (key in object && object[key] != null) return object[key];
    for (const value of Object.values(object)) {
      const result = walk(value, key);
      if (result != null) return result;
    }
  }
  return null;
}

module.exports = walk;
