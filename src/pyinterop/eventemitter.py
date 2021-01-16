class EventEmitter(object):
    def __init__(self):
        self.handlers = {}

    def on(self, objectName, handler):
        if (objectName not in self.handlers):
            self.handlers[objectName] = []
        self.handlers[objectName].append(handler)

    def emit(self, objectName, *args):
        if (objectName not in self.handlers):
            return
        for handler in self.handlers[objectName]:
            handler(*args)

    def removeListener(self, objectName, handler):
        if (objectName not in self.handlers):
            return
        if handler in self.handlers[objectName]:
            self.handlers[objectName].remove(handler)
