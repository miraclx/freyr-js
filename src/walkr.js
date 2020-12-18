function walk(object, key) {
  if (Array.isArray(object)) {
    for (let obj of object) {
      let result = walk(obj, key);
      if (result != null) return result;
    }
  } else if (typeof object == "object") {
    if (key in object && object[key] != null) return object[key];
    for (const value of Object.values(object)) {
      let result = walk(value, key);
      if (result != null) return result;
    }
  }
  return null;
}

module.exports = walk;
