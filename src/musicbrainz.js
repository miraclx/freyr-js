import got from 'got';
import NodeCache from 'node-cache';
import xml2js from 'xml2js';

class MusicBrainzError extends Error {
  constructor(message, statusCode) {
    super(message);
    if (statusCode) this.statusCode = statusCode;
  }
}

let cache = new NodeCache();

async function query(entity_type, entity, args) {
  let inc = Array.isArray(args.inc) ? args.inc.join('+') : '';
  let key = `${entity_type}:${entity}:${inc}`;
  if (!cache.has(key)) {
    let response = await got(`https://musicbrainz.org/ws/2/${entity_type}/${entity}`, {
      searchParams: {...(inc ? {inc} : {}), ...(args.json ? {fmt: 'json'} : {})},
    });
    let body;
    try {
      body = response.body.startsWith('<?xml')
        ? await xml2js.parseStringPromise(response.body, {
            trim: true,
            mergeAttrs: true,
            explicitRoot: false,
            explicitArray: false,
          })
        : JSON.parse(response.body);
    } catch {
      throw new MusicBrainzError('Invalid Server Response');
    }
    if (response.statusCode !== 200) {
      throw new MusicBrainzError(body.error || 'An error occurred', response.statusCode);
    }
    cache.set(key, body);
  }
  return cache.get(key);
}

async function lookupISRC(isrc, storefront) {
  let hello = (await query('isrc', isrc, {inc: ['releases']})).isrc['recording-list'];
  let trackId;
  let releases;
  // This should be explained
  if (Array.isArray(hello.recording)) {
    trackId = hello.recording[0].id;
    releases = hello.recording[0]['release-list'].release;
  } else {
    trackId = hello.recording.id;
    releases = hello.recording['release-list'].release;
  }
  releases = Array.isArray(releases) ? releases : [releases];

  // find one whose storefront matches and is probably digital media, otherwise take the first one
  let {id: releaseId} =
    releases.find(release => release.country?.toLowerCase() === storefront && release.packaging?._.toLowerCase() === 'none') ||
    releases[0];

  let release = await query('release', releaseId, {inc: ['artists', 'release-groups', 'media'], json: true});

  let {artist: artistMeta} = release['artist-credit'][0];
  return {
    trackId,
    releaseId,
    artistId: artistMeta.id,
    artistSortOrder: artistMeta['sort-name'],
    releaseGroupId: release['release-group'].id,
    releaseType: release['release-group']['primary-type'].toLowerCase(),
    releaseCountry: release.country,
    releaseStatus: release.status.toLowerCase(),
    media: release.media[0].format,
    script: release['text-representation'].script,
    barcode: release.barcode,
  };
}

export default {lookupISRC};
