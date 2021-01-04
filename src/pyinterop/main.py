import traceback
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "interoper_pkgs"))


class Math:
    def add(self, *args):
        return sum(args)

    def factorial(self, val):
        import math
        return str(math.factorial(val))


class YouTube:
    def _getCore(self):
        if not hasattr(self, '__core'):
            from youtube_dl import YoutubeDL
            self.__core = YoutubeDL({"quiet": True})
        return self.__core

    def lookup(self, url):
        return self._getCore().extract_info(url, download=False)


class YouTubeMusic:
    def _getCore(self):
        if not hasattr(self, '__core'):
            from ytmusicapi import YTMusic
            self.__core = YTMusic()
        return self.__core

    def search(self, query, *args):
        return self._getCore().search(query, *args)

    def get_artist(self, channelId):
        return self._getCore().get_artist(channelId)

    def get_artist_albums(self, channelId, params):
        return self._getCore().get_artist_albums(channelId, params)

    def get_album(self, browseId):
        return self._getCore().get_album(browseId)

    def get_song(self, videoId):
        return self._getCore().get_song(videoId)

    def get_lyrics(self, browseId):
        return self._getCore().get_lyrics(browseId)

    def get_watch_playlist(self, videoId, *args):
        return self._getCore().get_watch_playlist(videoId, *args)

    def get_playlist(self, playlistId, *args):
        return self._getCore().get_playlist(playlistId, *args)


handlers = {
    "math": Math(),
    "youtube": YouTube(),
    "ytmusic": YouTubeMusic(),
}


def init_app(exit_secret):
    while True:
        data = json.loads(receive())
        if data.get("C4NCL0S3") == exit_secret:
            break
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
            send(json.dumps(response, separators=(',', ':')))


def send(msg):
    outfile.write(msg + "\n")
    outfile.flush()


def receive():
    return infile.readline()


if __name__ == "__main__":
    global infile, outfile
    try:
        with os.fdopen(3, 'w') as outfile, os.fdopen(4) as infile:
            init_app(sys.argv[1])
    except BrokenPipeError:
        pass
