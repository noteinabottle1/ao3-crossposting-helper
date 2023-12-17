import {ANALYTICS} from './google-analytics.js';

/**
 * Object representing the data collected by the form.
 * @typedef {Object} PopupFormData
 * @property {string} url
 * @property {boolean} ao3_crosspost_label
 * @property {boolean} podfic_length_label
 * @property {string} podfic_length_value
 * @property {string} title_format
 * @property {string} summary_format
 * @property {(readonly string[])=} audioFormatTagOptionIds
 */

/**
 * Object representing the value of a template from the options page.
 * @typedef {Object} TemplateData
 * @property {string} default
 */

/**
 * Sets the value of the input, triggering all necessary events.
 * @param {HTMLInputElement|HTMLTextAreaElement} inputElement
 * @param {string} value
 */
export function setInputValue(inputElement, value) {
  const event = new InputEvent('input', {bubbles: true, data: value});
  inputElement.value = value;
  // Replicates the value changing.
  inputElement.dispatchEvent(event);
  // Replicates the user leaving focus of the input element.
  inputElement.dispatchEvent(new Event('change'));
}

/**
 * Sets the state of a checkbox, triggering all necessary events.
 * @param checkboxElement {HTMLInputElement}
 * @param isChecked {boolean}
 */
export function setCheckboxState(checkboxElement, isChecked) {
  checkboxElement.checked = isChecked;
  // Replicates the user leaving focus of the input element.
  checkboxElement.dispatchEvent(new Event('change'));
}

const DEFAULT_OPTIONS = {
  url: '',
  ao3_crosspost_label: true,
  transform_summary: true,
  transform_title: true,
  title_format: 'default',
  summary_format: 'default',
};

export async function setupStorage() {
  const {options, title_template, summary_template, notes_template} =
    await browser.storage.sync.get([
      'options',
      'title_template',
      'summary_template',
      'notes_template',
    ]);

  if (options === undefined) {
    await browser.storage.sync.set({options: DEFAULT_OPTIONS});
  } else if (
    options['title_format'] === undefined ||
    options['summary_format'] === undefined
  ) {
    // Preserve behavior for existing extension users.
    if (options['title_format'] === undefined) {
      if (options['transform_title']) {
        options['title_format'] = 'default';
      } else {
        options['title_format'] = 'orig';
      }
    }
    if (options['summary_format'] === undefined) {
      if (options['transform_summary']) {
        options['summary_format'] = 'default';
      } else {
        options['summary_format'] = 'orig';
      }
    }
    await browser.storage.sync.set({options});
  }
  if (title_template === undefined) {
    await browser.storage.sync.set({
      title_template: {default: '${title}'},
    });
  }
  if (summary_template === undefined) {
    await browser.storage.sync.set({
      summary_template: {
        default: '${summary}',
      },
    });
  }
  if (notes_template === undefined) {
    await browser.storage.sync.set({
      notes_template: {
        default: '',
        begin: false,
        end: false,
      },
    });
  }
}

export function setupGlobalEventLogging() {
  // Fire a page view event on load
  window.addEventListener('load', () => {
    ANALYTICS.firePageViewEvent(document.title, document.location.href);
  });

  // Listen globally for all button events
  document.addEventListener('click', event => {
    if ('id' in event.target) {
      ANALYTICS.fireEvent('click_button', {id: event.target.id});
    }
  });

  // Listen globally for all input events
  document.addEventListener('change', event => {
    if ('id' in event.target) {
      ANALYTICS.fireEvent('input_changed', {id: event.target.id});
    }
  });
}
