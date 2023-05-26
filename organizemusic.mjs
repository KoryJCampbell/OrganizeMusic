import fsOrig from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import fetch from 'node-fetch';

const fs = fsOrig.promises;

const musicDir = '/Users/korycampbell/Music';
const outputDir = '/Users/korycampbell/Music/Organize';
const lastFmApiKey = ''; // replace with your Last.fm API key

const allowedExtensions = new Set(['.mp3', '.flac', '.aac', '.wav', '.ogg']);

async function getTopTagForArtist(artist) {
  const url = new URL('http://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', 'artist.getTopTags');
  url.searchParams.set('artist', artist);
  url.searchParams.set('api_key', lastFmApiKey);
  url.searchParams.set('format', 'json');

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.message);
  }

  const topTag = data.toptags && data.toptags.tag && data.toptags.tag[0] && data.toptags.tag[0].name;
  if (!topTag) {
    throw new Error('No top tag found for artist');
  }

  return topTag;
}

async function processDirectory(directory) {
  const files = await fs.readdir(directory);
  console.log(`Reading files in directory: ${directory}`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(directory, file);

    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await processDirectory(filePath);
      continue;
    }

    if (!stat.isFile() || !allowedExtensions.has(path.extname(file))) {
      console.log(`Skipping file: ${file}`);
      continue;
    }

    try {
      const metadata = await mm.parseFile(filePath);
      const genre = metadata.common.genre && metadata.common.genre[0];
      console.log(`Genre for ${file}: ${genre}`);

      const topTag = await getTopTagForArtist(metadata.common.artist);
      console.log(`Top tag for ${metadata.common.artist}: ${topTag}`);

      if (topTag) {
        const genrePath = path.join(outputDir, topTag);

        try {
          await fs.access(genrePath);
        } catch {
          console.log(`Creating genre directory: ${genrePath}`);
          await fs.mkdir(genrePath, { recursive: true });
        }

        const newPath = path.join(genrePath, file);
        console.log(`Moving ${file} to ${newPath}`);
        await fs.rename(filePath, newPath);
      } else {
        console.log(`No top tag found for ${metadata.common.artist}`);
      }
    } catch (err) {
      console.error(`Failed to process ${file}: ${err}`);
    }
  }
}

async function moveFilesByGenre() {
  try {
    await processDirectory(musicDir);
  } catch (err) {
    console.error('Error occurred: ' + err);
  }
}

moveFilesByGenre();
