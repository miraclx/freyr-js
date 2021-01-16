const contain = fn => (...args) => new Promise(res => res(fn(...args)));
const diffuse = promise => Promise.resolve(promise).catch(() => {});
function deferrable(fn, containedResult) {
  const deferHandlers = [];
  return diffuse(
    (containedResult = contain(fn)(
      (handler, caller) => (
        deferHandlers.push(
          (caller = index => ((index = deferHandlers.indexOf(caller)) !== -1 && deferHandlers.splice(index, 1), handler())),
        ),
        caller
      ),
    )),
  )
    .then(() =>
      Promise.all(
        [...deferHandlers].reduce(
          (stack, caller, prev) => stack.concat([(prev = stack.pop()), diffuse(prev).then(contain(caller))]),
          [],
        ),
      ),
    )
    .then(() => containedResult);
}

async function main() {
  const final = await deferrable(async defer => {
    // create a resource within an async context
    console.log('\x1b[32m[a] opening async resource\x1b[0m');
    // synchronously register a means for closing the async resource
    // which will be executed even if the async context terminated from a thrown error
    const destroyA = defer(() => console.log('\x1b[32m[a] closing async resource\x1b[0m'));

    console.log('\x1b[33m[b] creating temporary directory\x1b[0m');
    const destroyB = defer(() => console.log('\x1b[33m[b] removing temporary directory\x1b[0m'));

    console.log('\x1b[34m[c] opening connection to hardware resource\x1b[0m');
    const destroyC = defer(() => console.log('\x1b[34m[c] closing connection to hardware resource\x1b[0m'));

    console.log('[d] allocating a portion of memory for some work');
    const destroyD = defer(() => {
      // this deferred executor fails during its execution.
      // Deferred executor errors become top priority and
      // are the relayed cause for the rejected promise.
      console.log('[d] deallocating that portion of memory');
      throw new Error('Failed to deallocate memory');
    });

    console.log('\x1b[35m[e] opening file for reading\x1b[0m');
    // despite the deferred executor prior to this one failing
    // we ensure this one gets its chance to equally run
    // in order to optimally free all resources
    const destroyE = defer(() => console.log('\x1b[35m[e] closing opened file\x1b[0m'));

    // optionally, you can manually destroy the
    // resource if all has gone well so far
    await destroyA();
    await destroyB();
    // a thrown error, this causes the context to be terminated
    if ((() => true)()) throw new Error('Some shady error occurred');
    //  because of the thrown error, these destructors can't run manually
    await destroyC();
    await destroyD();
    await destroyE();

    return 'Some Amazing Final Answer';
  });
  console.log(final);
}

module.exports = deferrable;

if (require.main === module) main().catch(err => console.error('An error occurred\n', err));
