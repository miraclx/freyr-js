const got = require('got');
const {parseStringPromise: xml2js} = require('xml2js');

class MusicBrainzError extends Error {
  constructor(message, statusCode) {
    super(message);
    if (statusCode) this.statusCode = statusCode;
  }
}

async function query(entity_type, entity, args) {
  let response = await got(`https://musicbrainz.org/ws/2/${entity_type}/${entity}?inc=artists+releases+discids`, {
    searchParams: {...args, ...('inc' in args ? {inc: args.inc.join('+')} : {}), ...(args.json ? {fmt: 'json'} : {})},
  });
  let body;
  try {
    body = response.body.startsWith('<?xml')
      ? await xml2js(response.body, {trim: true, mergeAttrs: true, explicitRoot: false, explicitArray: false})
      : JSON.parse(response.body);
  } catch {
    throw new MusicBrainzError('Invalid Server Response');
  }
  if (response.statusCode !== 200) {
    throw new MusicBrainzError(body.error || 'An error occurred', response.statusCode);
  }
  return body;
}

async function lookupISRC(isrc, storefront) {
  let {
    recording: {
      id: trackId,
      'release-list': {release: releases},
    },
  } = (await query('isrc', isrc, {inc: ['releases']})).isrc['recording-list'];
  releases = Array.isArray(releases) ? releases : [releases];

  let {id: releaseId} = releases.find(release => release.country.toLowerCase() === storefront) || releases[0];

  let release = await query('release', releaseId, {inc: ['artists', 'release-groups', 'media'], json: true});

  let {artist: artistMeta} = release['artist-credit'][0];
  return {
    trackId,
    releaseId,
    artistId: artistMeta.id,
    artistSortOrder: artistMeta['sort-name'],
    releaseGroupId: release['release-group'].id,
    releaseType: release['release-group']['primary-type'],
    releaseCountry: release.country,
    releaseStatus: release.status.toLowerCase(),
    media: release.media[0].format,
    script: release['text-representation'].script,
    barcode: release.barcode,
  };
}

module.exports = {lookupISRC};
