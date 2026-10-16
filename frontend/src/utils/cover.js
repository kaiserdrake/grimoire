// Generic cover for games without IGDB art, or whose cover URL fails to load
// (e.g. a manually added game with a typo'd or dead "Cover URL").
export const GENERIC_COVER = '/generic-cover.svg';

export const coverSrc = (url) => url || GENERIC_COVER;

// <img onError> handler: swap a broken cover for the generic one (once, to avoid loops).
export const fallbackToGenericCover = (e) => {
  const img = e.currentTarget;
  if (!img.src.endsWith(GENERIC_COVER)) img.src = GENERIC_COVER;
};
