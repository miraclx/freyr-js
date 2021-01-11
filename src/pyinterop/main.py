import traceback
import importlib
import queue
import json
import sys
import os

from parallelizer import Parallelizer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "interoper_pkgs"))


class Math:
    def add(self, *args):
        return sum(args)

    def factorial(self, val):
        import math
        return str(math.factorial(val))


class Utils:
    def sleep(self, secs):
        import time
        time.sleep(secs)

    def current_thread(self):
        from threading import current_thread
        t = current_thread()
        return {"name": t.name, "daemon": t.daemon, "ident": t.ident, "is_alive": t.is_alive(), "native_id": t.native_id}


handlers = {
    "math": Math(),
    "utils": Utils(),
}

for py in (f[:-3] for f in os.listdir(os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "handlers")) if f.endswith('.py')):
    cls = getattr(importlib.import_module(
        '.'.join(['handlers', py])), '__INTEROP_EXPORT__', None)
    if cls:
        handlers[py] = cls()


class TaskExecutor:
    def __init__(self, n_threads, handler):
        self._queue = queue.Queue()
        self._handler = handler
        self._jobs = Parallelizer(
            self._queue.get, n_threads, self._handler, allowedExceptions=(KeyboardInterrupt,))

    def start(self):
        self._jobs.start()
        return self

    def send(self, task):
        self._queue.put(task)
        return self

    def clear(self):
        from collections import deque
        self._jobs.pause()
        [dq, self._queue.queue] = [self._queue.queue, deque()]
        self._jobs.resume()
        dq.append(None)
        return self

    def cancel(self):
        self._jobs.cancel()
        self.clear()
        self._queue.put(None)

    def join(self):
        self._jobs.joinAll()


if __name__ == "__main__":
    global infile, outfile, sender, tasker

    def sender(response):
        outfile.write(json.dumps(response, separators=(',', ':')) + "\n")
        outfile.flush()

    sender = TaskExecutor(1, sender)

    def tasker(data):
        inputPayload = data["payload"]
        response = {"qID": data["qID"]}
        try:
            [root, method] = inputPayload["path"].split(':')
            if root not in handlers:
                raise KeyError(
                    f"Invalid root endpoint [{root}]")

            try:
                pointer = getattr(handlers[root], method)
            except AttributeError:
                raise AttributeError(
                    f"Root object [{root}] has no attribute [{method}]")

            if not callable(pointer):
                raise ValueError(
                    f"Root object attribute [{inputPayload['path']}] is not callable")

            response["payload"] = json.dumps(pointer(*inputPayload["data"]))
        except:
            exc = sys.exc_info()
            response["error"] = {"type": exc[0].__name__, "message": str(
                exc[1]), "traceback": traceback.format_exc()}
        finally:
            sender.send(response)

    tasker = TaskExecutor(4, tasker)

    tasker.start()
    sender.start()

    try:
        with os.fdopen(3, 'w') as outfile, os.fdopen(4) as infile:
            try:
                exit_secret = sys.argv[1]
                while True:
                    data = json.loads(infile.readline())
                    if data.get("C4NCL0S3") == exit_secret:
                        break
                    tasker.send(data)
            except KeyboardInterrupt:
                tasker._jobs.raiseExcAll(KeyboardInterrupt)
                sender._jobs.raiseExcAll(KeyboardInterrupt)
            finally:
                tasker.cancel()
                sender.cancel()
                tasker.join()
                sender.join()
    except BrokenPipeError:
        pass
