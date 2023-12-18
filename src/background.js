chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  fetchDoc(request.fetchUrl, request.init).then(sendResponse);
  return true;
});

async function fetchDoc(url) {
  // Attempt to parse the URL
  /** @type {URL} */
  let fetchUrl;
  try {
    if (url.includes('/chapters')) {
      // Strip the chapter number from the url
      url = url.substring(0, url.indexOf('/chapters'));
    }
    fetchUrl = new URL(url);
  } catch (e) {
    return {result: 'error', message: `Invalid work URL: ${e.message}`};
  }
  // View the full work, not just the first chapter
  fetchUrl.searchParams.set('view_full_work', 'true');
  // Always agree to the ToS
  fetchUrl.searchParams.set('tos', 'yes');
  // Always consent to seeing "adult content" to simplify parsing
  fetchUrl.searchParams.set('view_adult', 'true');
  // Initially try to get the work without credentials, this handles cases
  // where the user has tags or warnings hidden but can fail if the work
  // the user is importing from is only available to logged-in users.
  let result;
  try {
    result = await fetch(fetchUrl, {credentials: 'omit'});
  } catch (e) {
    return {
      result: 'error',
      message: `Failed to fetch the work! ${e.message}`,
    };
  }
  if (!result.ok) {
    return {
      result: 'error',
      message: `Failed to fetch the work! Error: ${result.status} ${result.statusText}`,
    };
  }

  // If we end up in this case it means that the work was not available to
  // logged out users so we will attempt the fetch again but this time we will
  // forward the user's credentials. If the user has warnings or tags hidden
  // then there will be errors later on but these are handled.
  if (result.redirected) {
    try {
      result = await window.fetch(fetchUrl, {credentials: 'include'});
    } catch (e) {
      return {
        result: 'error',
        message: `Failed to fetch the work! ${e.message}`,
      };
    }
    if (!result.ok) {
      return {
        result: 'error',
        message: `Failed to fetch the work! Error: ${result.status} ${result.statusText}`,
      };
    }
  }

  let html = await result.text();
  return html;
}
