const LOCALSTORAGE_KEYS = {
  accessToken: "spotify_access_token",
  refreshToken: "spotify_refresh_token",
  expireTime: "spotify_token_expire_time",
  timestamp: "spotify_token_timestamp",
};

const LOCALSTORAGE_VALUES = {
  accessToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.accessToken),
  refreshToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.refreshToken),
  expireTime: window.localStorage.getItem(LOCALSTORAGE_KEYS.expireTime),
  timestamp: window.localStorage.getItem(LOCALSTORAGE_KEYS.timestamp),
};

export const logout = () => {
  for (const property in LOCALSTORAGE_KEYS) {
    window.localStorage.removeItem(LOCALSTORAGE_KEYS[property]);
  }

  window.location = window.location.origin;
};

const refreshToken = async () => {
  try {
    // Logout if there's no refresh token stored or we've managed to get into a reload infinite loop
    if (
      !LOCALSTORAGE_VALUES.refreshToken ||
      LOCALSTORAGE_VALUES.refreshToken === "undefined"
    ) {
      console.error("No refresh token available or possible infinite loop");
      logout();
      return;
    }

    // Use `/refresh_token` endpoint from our Node app
    const res = await fetch(
      `${import.meta.env.VITE_FRONTEND_URI}/refresh_token?refresh_token=${
        LOCALSTORAGE_VALUES.refreshToken
      }`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOCALSTORAGE_VALUES.accessToken}`,
        },
      },
    );

    const data = await res.json();

    if (!data.access_token) {
      console.error("Failed to refresh token");
      logout();
      return;
    }

    // Update localStorage values
    window.localStorage.setItem(
      LOCALSTORAGE_KEYS.accessToken,
      data.access_token,
    );
    window.localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now());

    // Only reload if the access token was refreshed successfully
    console.log("Token refreshed successfully, reloading");
    window.location.reload();
  } catch (e) {
    console.error(e);
    logout();
  }
};

const hasTokenExpired = () => {
  const { accessToken, timestamp, expireTime } = LOCALSTORAGE_VALUES;
  if (!accessToken || !timestamp) {
    return false;
  }
  const millisecondsElapsed = Date.now() - Number(timestamp);
  return millisecondsElapsed / 1000 > Number(expireTime);
};

const getAccessToken = () => {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  const queryParams = {
    [LOCALSTORAGE_KEYS.accessToken]: urlParams.get("access_token"),
    [LOCALSTORAGE_KEYS.refreshToken]: urlParams.get("refresh_token"),
    [LOCALSTORAGE_KEYS.expireTime]: urlParams.get("expires_in"),
  };

  const hasError = urlParams.get("error");

  // If there's an error OR the token in localStorage has expired, refresh the token
  if (
    hasError ||
    hasTokenExpired() ||
    LOCALSTORAGE_VALUES.accessToken === "undefined"
  ) {
    refreshToken();
  }

  // If there is a valid access token in localStorage, use that
  if (
    LOCALSTORAGE_VALUES.accessToken &&
    LOCALSTORAGE_VALUES.accessToken !== "undefined"
  ) {
    return LOCALSTORAGE_VALUES.accessToken;
  }

  // If there is a token in the URL query params, user is logging in for the first time
  if (queryParams[LOCALSTORAGE_KEYS.accessToken]) {
    // Store the query params in localStorage
    for (const property in queryParams) {
      window.localStorage.setItem(property, queryParams[property]);
    }
    window.localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now());
    return queryParams[LOCALSTORAGE_KEYS.accessToken];
  }

  // We should never get here!
  return false;
};

export const accessToken = getAccessToken();

export const getCurrentUserProfile = () =>
  fetch("https://api.spotify.com/v1/me", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

export const getUserNumPlaylists = () =>
  fetch("https://api.spotify.com/v1/me/playlists", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

export const getTopArtists = (limit = 10, time_range = "long_term") =>
  fetch(
    `https://api.spotify.com/v1/me/top/artists?time_range=${time_range}&limit=${limit}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

export const getArtist = (id) =>
  fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

export const getTopTracks = (limit = 10, time_range = "long_term") =>
  fetch(
    `https://api.spotify.com/v1/me/top/tracks?time_range=${time_range}&limit=${limit}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

export const getTrack = (id) =>
  Promise.all([
    fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }),
    fetch(`https://api.spotify.com/v1/audio-features/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }),
  ]);

export const getPlaylists = () =>
  fetch(`https://api.spotify.com/v1/me/playlists`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

export const getSpotRecommendations = async (playlist, maxPopularity) => {
  // console.log(playlist);
  // console.log(playlist.tracks.total);
  // console.log(maxPopularity);

  let randomOffset = null;

  if (playlist.tracks.total > 50) {
    randomOffset = Math.floor(Math.random() * (playlist.tracks.total - 49));
  } else {
    randomOffset = 0;
  }

  const tracksRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?offset=${randomOffset}&limit=50`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const trackData = await tracksRes.json();

  // console.log(trackData);
  const shuffled = [...trackData.items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let seedTracks = null;

  if (playlist.tracks.total > 5) {
    seedTracks = shuffled.slice(0, 5);
  } else {
    seedTracks = shuffled;
  }

  let seedQueryParam = "";
  seedTracks.forEach((track, index) => {
    if (index === seedTracks.length - 1) {
      seedQueryParam += `${track.track.id}`;
    } else {
      seedQueryParam += `${track.track.id},`;
    }
  });

  return fetch(
    `https://api.spotify.com/v1/recommendations?seed_tracks=${seedQueryParam}&target_popularity=${maxPopularity}&limit=25`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
};

export const addSpotPlaylist = async (playlist, tracks) => {
  const userRes = await getCurrentUserProfile();
  const userData = await userRes.json();

  // console.log(playlist.name);
  // console.log(userData.id);

  const createPlaylistRes = await fetch(
    `https://api.spotify.com/v1/users/${userData.id}/playlists`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: `Suggestions based on ${playlist.name}`,
        description: "Generated Playlist",
        public: false,
      }),
    },
  );

  const createPlaylistData = await createPlaylistRes.json();

  await fetch(
    `https://api.spotify.com/v1/playlists/${createPlaylistData.id}/tracks`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        uris: tracks.map((track) => track.uri),
      }),
    },
  );

  // console.log("here");

  return createPlaylistData;
};
