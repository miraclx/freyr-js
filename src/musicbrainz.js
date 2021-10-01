async function gatherMusicBrainzMetadata(track, trackLogger)
{
	var musicBrainz = [];
    if (track.isrc !== "") {
      trackLogger.print('| [\u2022] Obtaining MusicBrainz metadata...');
  
      const got = require('got');
      var parser = require('xml2js');
  
      await got(`https://musicbrainz.org/ws/2/isrc/${track.isrc}?inc=artist-credits+releases`).then(response => {
        trackLogger.write('[done]\n');
        try {
          // Should 'explicitArray: false' be used ?
          parser.parseString(response.body, { trim: true, mergeAttrs: true }, function (err, result) {
            const recording = result.metadata.isrc[0]['recording-list'][0]['recording'][0];
  
            try {
              musicBrainz.trackId = recording['id'][0];
            } catch { };
            trackLogger.log(`| \u27a4 TrackId: ${musicBrainz.trackId}`);
            try {
              musicBrainz.artistId = recording['artist-credit'][0]['name-credit'][0]['artist'][0]['id'][0];
            } catch { };
            trackLogger.log(`| \u27a4 ArtistId: ${musicBrainz.artistId}`);
  
            // Searching for a matching album
            const releases = recording['release-list'][0]['release'].filter(obj => {
              const title = obj.title[0].replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"'); // Removing weird characters that can cause fails
              return track.album.localeCompare(title) == 0;
            });
  
            try {
              musicBrainz.albumId = releases[0]['id'][0];
              bim.hello = true;
            }
            catch { };
            trackLogger.log(`| \u27a4 AlbumId: ${musicBrainz.albumId}`);
            try {
              musicBrainz.albumArtistId = releases[0]['artist-credit'][0]['name-credit'][0]['artist'][0]['id'][0];
            } catch { };
            trackLogger.log(`| \u27a4 AlbumArtistId: ${musicBrainz.albumArtistId}`);
          });
        } catch (error) {
          trackLogger.log(error);
        }
        //
      }).catch(error => {
        trackLogger.write(`[failed, ${error.message}]\n`);
      });
    }
	return musicBrainz;
}

module.exports = {
	gatherMusicBrainzMetadata,
  };
  