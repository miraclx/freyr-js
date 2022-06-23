import Promise from 'bluebird';

export default async function flattener(array) {
  array = await array;
  return (
    await Promise.mapSeries(Array.isArray(array) ? array : [], async item =>
      !Array.isArray(item) ? item : flattener(item.flat(Infinity)),
    )
  ).flat(Infinity);
}
