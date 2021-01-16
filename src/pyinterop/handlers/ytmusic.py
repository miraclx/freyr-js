class YouTubeMusic:
    __interop_args = ()

    def _getCore(self):
        if not hasattr(self, '__core'):
            from ytmusicapi import YTMusic
            self.__core = YTMusic(*self.__interop_args)
        return self.__core

    def _interop_init(self, *args):
        self.__interop_args = args

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


__INTEROP_EXPORT__ = YouTubeMusic
