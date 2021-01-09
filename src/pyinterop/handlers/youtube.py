class YouTube:
    def _getCore(self):
        if not hasattr(self, '__core'):
            from youtube_dl import YoutubeDL
            self.__core = YoutubeDL({"quiet": True})
        return self.__core

    def lookup(self, url):
        return self._getCore().extract_info(url, download=False)


__INTEROP_EXPORT__ = YouTube
