import traceback
import json
import sys


def add(*args):
    return sum(args)


def factorial(val):
    import math
    return str(math.factorial(val))


handlers = {
    "add": add,
    "factorial": factorial,
}


def init_app(exit_secret):
    while True:
        data = json.loads(sys.stdin.readline())
        if data.get("C4NCL0S3") == exit_secret:
            break
        inputPayload = data["payload"]
        response = {"qID": data["qID"]}
        try:
            if inputPayload["path"] not in handlers:
                raise KeyError(
                    f"Invalid query endpoint [{inputPayload['path']}]")
            handler = handlers[inputPayload["path"]]
            response["payload"] = handler(*inputPayload["data"])
        except:
            exc = sys.exc_info()
            response["error"] = {"type": exc[0].__name__, "message": str(
                exc[1]), "traceback": traceback.format_exc()}
        finally:
            print(json.dumps(response), flush=True)


if __name__ == "__main__":
    init_app(sys.argv[1])
