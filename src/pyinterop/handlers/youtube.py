class YouTube:
    __interop_args = ()

    def _getCore(self):
        if not hasattr(self, '__core'):
            from youtube_dl import YoutubeDL
            self.__core = YoutubeDL(*self.__interop_args)
        return self.__core

    def _interop_init(self, *args):
        self.__interop_args = args

    def lookup(self, url):
        return self._getCore().extract_info(url, download=False)


__INTEROP_EXPORT__ = YouTube
