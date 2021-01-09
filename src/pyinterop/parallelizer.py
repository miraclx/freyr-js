import ctypes
import threading
from inspect import signature
from eventemitter import EventEmitter


class Parallelizer(EventEmitter):
    def __init__(self, items, jobs, handler, *, sentinel=None, allowedExceptions=()):
        super().__init__()
        try:
            jobs = min(jobs, len(items))
        except:
            pass
        self.__items = iter(items) if not callable(
            items) else iter(items, sentinel)
        self.__itemsLock = threading.Lock()
        self.__takesChecker = len(signature(handler).parameters) == 2
        self.__handler = handler
        self.__threads = []
        self.__doneLock = threading.Lock()
        self.__started = threading.Event()
        self.__finished = threading.Event()
        self.__allowedExceptions = allowedExceptions
        for job in range(jobs):
            self.__newThread(job)

    def __threadHandler(self, threadEvent, cancelledEvent, notPausedEvent):
        def newConstraintChecker(listeners):
            def checkConstraint(handle=None, persist=False):
                if handle:
                    with cancelledEvent._cond:
                        if cancelledEvent.isSet():
                            handle()
                        else:
                            if not persist:
                                listeners.append(handle)
                            threadEvent.on("cancel", handle)
                else:
                    return cancelledEvent.isSet()
            return checkConstraint

        try:
            while not cancelledEvent.isSet():
                notPausedEvent.wait()
                listeners = []
                try:
                    try:
                        with self.__itemsLock:
                            item = next(self.__items)
                    except StopIteration:
                        break
                    if self.__takesChecker:
                        self.__handler(item, newConstraintChecker(listeners))
                    else:
                        self.__handler(item)
                finally:
                    for listener in listeners:
                        threadEvent.removeListener("cancel", listener)
        except self.__allowedExceptions:
            pass
        finally:
            self.__tickThread()

    def __tickThread(self):
        if not self.hasStarted():
            return
        with self.__doneLock:
            if all(
                    (threadStack["thread"]._started.isSet()
                     and not threadStack["thread"].is_alive())
                    for threadStack in self.__threads if threadStack["thread"] != threading.current_thread()):
                self.__finished.set()
                self.emit("finished")

    def __newThread(self, index):
        threadEvent = EventEmitter()
        notPausedEvent = threading.Event()
        cancelledEvent = threading.Event()
        threadEvent.on("pause", notPausedEvent.clear)
        threadEvent.on("cancel", cancelledEvent.set)
        threadEvent.on("resume", notPausedEvent.set)
        notPausedEvent.set()
        thread = threading.Thread(
            name="ParallelizerThread-%d" % index,
            target=self.__threadHandler,
            args=(threadEvent, cancelledEvent, notPausedEvent))
        self.__threads.append(
            {
                "thread": thread,
                "cancelled": cancelledEvent,
                "threadEvent": threadEvent,
                "notPausedEvent": notPausedEvent
            })

    def start(self):
        if self.hasStarted():
            raise RuntimeError(
                "Parallelizer instances can only be started once")
        self.__started.set()
        self.emit("started")
        for threadStack in self.__threads:
            threadStack["thread"].start()

    def hasStarted(self):
        return self.__started.isSet()

    def finished(self, n):
        return self.hasStarted() and not self.__threads[n]["thread"].is_alive()

    def allFinished(self):
        return self.__finished.isSet()

    def wait(self, n=None):
        return self.__finished.wait(n)

    def cancelled(self, n):
        return self.__threads[n]["cancelled"].isSet()

    def allCancelled(self):
        return all(threadStack["cancelled"].isSet() for threadStack in self.__threads)

    def cancel(self):
        for threadStack in self.__threads:
            threadStack["threadEvent"].emit("cancel")
        self.emit("cancel")

    def raiseExc(self, n, exc):
        if not (tid := getattr(self.__threads[n]["thread"], '_ident', None) or next(iter(
                ([None] + [id for id, obj in threading._active.items() if obj is self.__threads[n]["thread"]]).pop, None), None)):
            raise AssertionError("could not determine thread id")
        res = ctypes.pythonapi.PyThreadState_SetAsyncExc(
            ctypes.c_long(tid), ctypes.py_object(exc))
        if res == 0:
            raise ValueError("invalid thread ID")
        elif res != 1:
            raise SystemError("PyThreadState_SetAsyncExc failed")
            ctypes.pythonapi.PyThreadState_SetAsyncExc(tid, 0)

    def raiseExcAll(self, exc):
        for n, _ in enumerate(self.__threads):
            self.raiseExc(n, exc)

    def pause(self):
        for threadStack in self.__threads:
            threadStack["threadEvent"].emit("pause")
        self.emit("pause")

    def resume(self):
        for threadStack in self.__threads:
            threadStack["threadEvent"].emit("resume")
        self.emit("resume")

    def join(self, n):
        return self.__threads[n]["thread"].join()

    def joinAll(self):
        for threadStack in self.__threads:
            threadStack["thread"].join()


if __name__ == "__main__":
    import time

    def test1():
        def executor(item, doCancel):
            thread = threading.current_thread()
            print(" * item %d on %a, init (cancel = %a)" %
                  (item, thread.getName(), doCancel()))
            time.sleep(1)
            print(" * item %d on %a, done (cancel = %a)" %
                  (item, thread.getName(), doCancel()))

        par = Parallelizer(range(4), 2, executor)
        par.on("started", lambda: print(" Started thread execution"))
        par.on("finished", lambda: print(" All threads finished execution"))
        print("[\x1b[32mtest1\x1b[0m]: basic threads")
        par.start()
        par.joinAll()

    def test2():
        def executor(item, doCancel):
            thread = threading.current_thread()
            print(" * item %d on %a, init (cancel = %a)" %
                  (item, thread.getName(), doCancel()))
            time.sleep(1)
            print(" * item %d on %a, done (cancel = %a)" %
                  (item, thread.getName(), doCancel()))

        par = Parallelizer(range(10), 4, executor)
        par.on("cancel", lambda: print(" Cancelling jobs"))
        par.on("started", lambda: print(" Started thread execution"))
        par.on("finished", lambda: print(" All threads finished execution"))
        print("[\x1b[32mtest2\x1b[0m]: basic cancellable threads")
        par.start()
        par.cancel()
        par.joinAll()

    def test3():
        import queue
        q = queue.Queue()

        def executor(item, doCancel):
            thread = threading.current_thread()
            print(" * item %02d on %a, init (cancel = %a)" %
                  (item, thread.getName(), doCancel()))
            time.sleep(1)
            print(" * item %02d on %a, done (cancel = %a)" %
                  (item, thread.getName(), doCancel()))

        par = Parallelizer(q.get, 4, executor, sentinel=None)
        par.on("cancel", lambda: print(" Cancelling jobs"))
        par.on("cancel", lambda: q.put(None))
        par.on("started", lambda: print(" Started thread execution"))
        par.on("finished", lambda: print(" All threads finished execution"))
        print("[\x1b[32mtest3\x1b[0m]: pausable and cancellable threads")
        print("(i) Use ctrl+c to pause threads")
        try:
            par.start()
            for item in range(20):
                q.put(item)
            q.put(None)
            par.joinAll()
        except KeyboardInterrupt:
            print(" (i) Use ctrl+c to resume threads")
            par.pause()
            print("(i) Paused!")
            try:
                par.joinAll()
            except KeyboardInterrupt:
                print(" (i) Use ctrl+c to cancel threads")
                par.resume()
                print("(i) Resumed!")
                try:
                    par.joinAll()
                except KeyboardInterrupt:
                    par.cancel()
                    par.joinAll()

    def test4():
        def executor(item, doCancel):
            event = threading.Event()
            thread = threading.current_thread()
            print(" * item %d on %a, init (cancel = %a)" %
                  (item, thread.getName(), doCancel()))
            doCancel(lambda: event.set())
            event.wait()
            print(" * item %d on %a, done (cancel = %a)" %
                  (item, thread.getName(), doCancel()))
        par = Parallelizer(range(4), 2, executor)
        par.on("cancel", lambda: print(" Cancelling jobs"))
        par.on("started", lambda: print(" Started thread execution"))
        par.on("finished", lambda: print(" All threads finished execution"))
        print("[\x1b[32mtest4\x1b[0m]: cancellable threads blocked waiting on event, cancel by forcefully setting event")
        print("(i) Use ctrl+c to cancel threads")
        try:
            par.start()
            par.joinAll()
        except KeyboardInterrupt:
            par.cancel()
            par.joinAll()

    print("Running test 1")
    test1()
    print()
    print("Running test 2")
    test2()
    print()
    print("Running test 3")
    test3()
    print()
    print("Running test 4")
    test4()
