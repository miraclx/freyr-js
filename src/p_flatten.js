const {mapSeries} = require('bluebird');

module.exports = async function flattener(array) {
  array = await array;
  return (
    await mapSeries(Array.isArray(array) ? array : [], async item =>
      !Array.isArray(item) ? item : flattener(item.flat(Infinity)),
    )
  ).flat(Infinity);
};
