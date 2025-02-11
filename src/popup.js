import {
  setCheckboxState,
  setInputValue,
  setupStorage,
  setupGlobalEventLogging,
} from './utils.js';
import {ANALYTICS} from './google-analytics.js';

setupGlobalEventLogging();

// Setup for the navbar used in all views.
const optionsButton = /** @type {HTMLAnchorElement} */ (
  document.getElementById('options_button')
);
optionsButton.href = browser.runtime.getURL('options.html');

/**
 * A list of URL patterns that the popup can operate on.
 * @type {Array<RegExp|string>}
 */
const ALLOWED_URL_PATTERNS = [
  // Standard new work
  'https://squidgeworld.org/works/new',
  // New work added to a collection
  /https:\/\/squidgeworld.org\/collections\/(.*)\/works\/new/,
  // Editing an existing work
  /https:\/\/squidgeworld.org\/works\/[0-9]+\/edit/,
  // Adding a chapter to an existing work
  /https:\/\/squidgeworld.org\/works\/[0-9]+\/chapters\/new/,
  /https:\/\/squidgeworld.org\/works\/[0-9]+\/chapters\/[0-9]+\/edit/,
  // Same as above but for AO3
  'https://archiveofourown.org/works/new',
  /https:\/\/archiveofourown.org\/collections\/(.*)\/works\/new/,
  /https:\/\/archiveofourown.org\/works\/[0-9]+\/edit/,
  /https:\/\/archiveofourown.org\/works\/[0-9]+\/chapters\/new/,
  /https:\/\/archiveofourown.org\/works\/[0-9]+\/chapters\/[0-9]+\/edit/,
];

(async () => {
  const [currentTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  // If no allowed URL matches then we are not on a page we support.
  if (
    !ALLOWED_URL_PATTERNS.some(
      allowedUrlPattern => currentTab.url.match(allowedUrlPattern) !== null
    )
  ) {
    document.querySelector(
      '.page-content'
    ).innerHTML = `This extension can only be used on AO3 or Squidgeworld to create a new work,
        create a new work in a collection, or edit an existing work.
        Please go to a supported URL and click the extension icon again.
        To create a new work go to
        <a
            href="https://archiveofourown.org/works/new"
            target="_blank"
            rel="noopener"
            id="ao3-new-work">
                https://archiveofourown.org/works/new</a>`;
    ANALYTICS.firePageViewEvent('Not on new work URL page');
  } else {
    ANALYTICS.firePageViewEvent('Form');
    await setupPopup();
  }
})();

async function setupPopup() {
  const urlInput = /** @type {HTMLInputElement} */ (
    document.getElementById('url-input')
  );
  /** @type {HTMLFormElement} */
  const form = document.getElementsByTagName('form')[0];
  const podficLabel = /** @type {HTMLInputElement} */ (
    document.getElementById('ao3_crosspost_label')
  );
  const titleFormatValue = /** @type {HTMLInputElement} */ (
    document.getElementById('title_template_value')
  );
  const summaryFormatValue = /** @type {HTMLInputElement} */ (
    document.getElementById('summary_template_value')
  );
  /** @type {mdc.textField.MDCTextField} */
  const urlTextField = document.querySelector('.mdc-text-field').MDCTextField;
  const snackbar = document.querySelector('.mdc-snackbar').MDCSnackbar;
  /** @type {HTMLButtonElement} */
  const submitButton = document.querySelector('#import');
  const optionsLink = /** @type {HTMLAnchorElement} */ (
    document.getElementById('options-link')
  );
  optionsLink.href = browser.runtime.getURL('options.html');

  // Setting this means that we have to update the validity of the text field
  // when native validation shows the field as invalid. This is the only way
  // we can keep validation in sync with our submit only validity checks.
  urlTextField.useNativeValidation = false;

  // Defensively, we add the listeners first, so even if we fail to read some
  // information from storage we should be able to recover on submit.

  urlInput.addEventListener('input', () => {
    // Always clear the custom error when the user changes the value.
    urlTextField.helperTextContent = '';
    // Keep the text field in sync with the input.
    urlTextField.valid = urlInput.validity.valid;
  });

  // When the form is submitted, import metadata from original work.
  form.addEventListener('submit', async submitEvent => {
    // Need to prevent the default so that the popup doesn't refresh.
    submitEvent.preventDefault();
    // Clear any existing errors as they are no longer relevant
    urlTextField.valid = true;
    urlTextField.helperTextContent = '';
    // Disable submitting the form until we get a result back
    submitButton.disabled = true;

    // Save the options, because we won't be able to access them in the injected
    // script.
    await browser.storage.sync.set({
      options: {
        url: urlInput.value.trim(),
        ao3_crosspost_label: podficLabel.checked,
        title_format: titleFormatValue.value,
        summary_format: summaryFormatValue.value,
      },
    });

    ANALYTICS.fireEvent('popup_form_submit', {
      ao3_crosspost_label: String(podficLabel.checked),
      title_format: titleFormatValue.value,
      summary_format: summaryFormatValue.value,
    });

    const [tab] = await browser.tabs.query({active: true, currentWindow: true});
    let result;
    try {
      const injectedScriptResults = await browser.scripting.executeScript({
        target: {tabId: tab.id},
        files: ['/resources/browser-polyfill.min.js', '/inject.js'],
      });
      // We only have one target so there is only one result.
      result = injectedScriptResults[0].result;
    } catch (e) {
      result = {result: 'error', message: `${e.message}: ${e.stack}`};
    }
    submitButton.disabled = false;
    if (result.result === 'error') {
      urlTextField.valid = false;
      urlTextField.helperTextContent = result.message;
      urlTextField.focus();
      ANALYTICS.fireErrorEvent(result.message);
    } else {
      snackbar.open();
    }
  });

  await setupStorage();

  // Import pop-up options from storage.
  const data = await browser.storage.sync.get('options');

  /** @type {import("./utils.js").PopupFormData} */
  const options = data['options'];

  setInputValue(urlInput, options['url']);
  setCheckboxState(podficLabel, options['ao3_crosspost_label']);

  /**
   * For some reason a select is really stupid so we have to find the option
   * with the correct text and click it.
   * @param selectElement {HTMLElement}
   * @param optionValue {string}
   */
  function clickSelectOption(selectElement, optionValue) {
    const optionElements = selectElement.querySelectorAll('li');
    const optionMatchingValue = Array.from(optionElements).find(
      option => option.dataset.value === optionValue
    );
    if (optionMatchingValue) {
      optionMatchingValue.click();
    }
  }

  // The title format has special considerations
  const titleSelectElement = document.getElementById('title-template-select');
  const titleSelectInputElement = titleSelectElement.querySelector('input');
  setInputValue(titleSelectInputElement, options['title_format']);
  clickSelectOption(titleSelectElement, options['title_format']);

  // And again for the summary format
  const summarySelectElement = document.getElementById(
    'summary-template-select'
  );
  const summarySelectInputElement = summarySelectElement.querySelector('input');
  setInputValue(summarySelectInputElement, options['summary_format']);
  clickSelectOption(summarySelectElement, options['summary_format']);

  // Focus the URL input for a11y.
  urlInput.focus();
}
