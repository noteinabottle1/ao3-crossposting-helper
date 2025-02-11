(async () => {
  /**
   * Object representing the data available to the injected script.
   * @typedef {Object} InjectedScriptStorageData
   * @property {import("./utils.js").PopupFormData} options
   * @property {import("./utils.js").TemplateData} summary_template
   * @property {import("./utils.js").TemplateData} title_template
   * @property {import("./utils.js").TemplateData} notes_template
   */

  // Duplicated because they need to exist in the injected script.
  /**
   * Query a (potentially empty) list of HTMLElements
   * @param {ParentNode} parent
   * @param {string} query
   * @return {HTMLElement[]}
   */
  function queryElements(parent, query) {
    if (parent === undefined) {
      return [];
    }
    return Array.from(parent.querySelectorAll(query));
  }

  /**
   * Query to get the first matching HTMLElement
   * @param {ParentNode} parent
   * @param {string} query
   * @return {HTMLElement}
   */
  function queryElement(parent, query) {
    return queryElements(parent, query)[0];
  }

  /**
   * Return a map from option text to option value.
   * @param {HTMLSelectElement|undefined} [select]
   * @returns {Map<string,string>}
   */
  function mapOptions(select) {
    return Array.from(select?.querySelectorAll('option') || []).reduce(
      (total, optionElement) => {
        total.set(optionElement.innerText.trim(), optionElement.value);
        return total;
      },
      new Map()
    );
  }

  /**
   * Return a map from input text to input element.
   * @param {HTMLInputElement[]} inputs
   * @returns {Map<string,HTMLInputElement>}
   */
  function mapInputs(inputs) {
    return inputs.reduce((total, inputElement) => {
      total.set(inputElement.value.trim(), inputElement);
      return total;
    }, new Map());
  }

  /**
   * @param url {string}
   */
  function canonicalUrl(url) {
    // https://squidgeworld.org/
    if (url.startsWith('http')) {
      return url;
    } else {
      return 'https://squidgeworld.org' + url;
    }
  }

  /**
   * Format a url and some text as a (string) <a> tag.
   * @param {string} url
   * @param {string} text
   * @returns {string}
   */
  function link(url, text) {
    return '<a href="' + canonicalUrl(url) + '">' + text + '</a>';
  }

  /**
   * Transform a summary according to keywords in the template string.
   * Keywords must be wrapped by ${} (e.g. ${title}). Keywords are not
   * case-sensitive, and include:
   *   * blocksummary
   *   * summary
   *   * title
   *   * author
   *   * authors
   * @param {string} template
   * @param {string} summary
   * @param {string} title
   * @param {string} url
   * @param {Map<string,string>} authors
   * @returns
   */
  function transformHtmlTemplate(template, summary, title, url, authors) {
    const titleLink = link(url, title);
    const authorsLinks = Array.from(authors)
      .map(([author, authorUrl]) => link(authorUrl, author))
      .join(', ');
    const authorsText = Array.from(authors)
      .map(([author]) => author)
      .join(', ');
    const blockSummaryText = '<blockquote>' + summary + '</blockquote>';

    let newSummary = template;
    newSummary = newSummary.replaceAll('${blocksummary}', blockSummaryText);
    newSummary = newSummary.replaceAll('${summary}', summary);
    newSummary = newSummary.replaceAll('${title}', titleLink);
    newSummary = newSummary.replaceAll('${title-unlinked}', title);
    newSummary = newSummary.replaceAll('${authors}', authorsLinks);
    newSummary = newSummary.replaceAll('${author}', authorsLinks);
    newSummary = newSummary.replaceAll('${authors-unlinked}', authorsText);
    newSummary = newSummary.replaceAll('${author-unlinked}', authorsText);

    return newSummary;
  }

  /**
   * Transform a title according to keywords in the template string.
   * Keywords must be wrapped by ${} (e.g. ${title}). Keywords are not
   * case-sensitive, and include:
   *   * title
   *   * author
   *   * authors
   * @param template {string}
   * @param title {string}
   * @param authors {Map<string,string>}
   * @returns
   */
  function transformTitle(template, title, authors) {
    const authorsText = Array.from(authors)
      .map(([author]) => author)
      .join(', ');

    let newTitle = template;
    newTitle = newTitle.replaceAll('${title}', title);
    newTitle = newTitle.replaceAll('${title-unlinked}', title);
    newTitle = newTitle.replaceAll('${authors}', authorsText);
    newTitle = newTitle.replaceAll('${author}', authorsText);
    newTitle = newTitle.replaceAll('${authors-unlinked}', authorsText);
    newTitle = newTitle.replaceAll('${author-unlinked}', authorsText);

    return newTitle;
  }

  /**
   * Figure out what template to use based on the title options and
   * custom template.
   * @param titleOption {string}
   * @param customTemplate {string}
   * @returns
   */
  function getTitleTemplate(titleOption, customTemplate) {
    switch (titleOption) {
      case 'blank':
        return '';
      case 'orig':
        return '${title}';
      case 'custom':
        return customTemplate;
      default:
        return '${title}';
    }
  }

  /**
   * Figure out what template to use based on the summary options and
   * custom template.
   * @param summaryOption {string}
   * @param customTemplate {string}
   * @returns
   */
  function getSummaryTemplate(summaryOption, customTemplate) {
    switch (summaryOption) {
      case 'blank':
        return '';
      case 'orig':
        return '${summary}';
      case 'custom':
        return customTemplate;
      default:
        return '${summary}';
    }
  }

  /**
   * Sets the value of a tag input, triggering all necessary events.
   * @param inputElement {HTMLInputElement}
   * @param value {string}
   */
  function setTagsInputValue(inputElement, value) {
    const event = new InputEvent('input', {bubbles: true, data: value});
    inputElement.value = value;
    // Replicates the value changing.
    inputElement.dispatchEvent(event);
    // Replicates the user hitting comma.
    inputElement.dispatchEvent(new KeyboardEvent('keydown', {key: ','}));
  }

  /**
   * Strip <p> tags, since AO3 doesn't like them in the summary.
   * @param {HTMLElement|undefined} summary
   */
  function sanitizeSummary(summary) {
    if (!summary) {
      return '';
    }
    // An opening <p> tag (shouldn't have attributes,
    // but even if it does, we can still strip it)
    const pOpen = /\s*<p(\s[^>]*)?>\s*/g;
    // A closing </p> tag
    const pClose = /\s*<\/p>\s*/g;
    const atats = /@@@+/g;
    return summary.innerHTML
      .replace(pOpen, '@@@')
      .replace(pClose, '@@@')
      .replace(atats, '\n\n')
      .trim();
  }

  /**
   * Strip <p> tags, since AO3 doesn't like them in the notes.
   * @param {HTMLElement|undefined} summary
   */
  function sanitizeNotes(note) {
    if (!note) {
      return '';
    }
    // An opening <p> tag (shouldn't have attributes,
    // but even if it does, we can still strip it)
    const pOpen = /\s*<p(\s[^>]*)?>\s*/g;
    // A closing </p> tag
    const pClose = /\s*<\/p>\s*/g;
    const atats = /@@@+/g;
    return note.innerHTML
      .replace(pOpen, '@@@')
      .replace(pClose, '@@@')
      .replace(atats, '\n\n')
      .trim();
  }

  /**
   * Transform a list of <a> html elements into a map from link text to link
   * url.
   * @param authors {HTMLElement[]}
   * @returns {Array<[string,string]>}
   */
  function mapAuthors(authors) {
    return Array.from(
      authors
        .reduce((total, authorLink) => {
          // Check that this is actually a link to an
          // author--it could be a giftee.
          if (authorLink.getAttribute('rel') == 'author') {
            total.set(
              authorLink.innerText.trim(),
              authorLink.getAttribute('href')
            );
          }
          return total;
        }, new Map())
        .entries()
    );
  }

  /**
   * Parse the metadata from a work page.
   * @param doc {Document}
   * @returns
   */
  function parseGenMetadata(doc) {
    const meta = queryElement(doc, '.meta');
    const rating = queryElement(meta, 'dd.rating.tags').innerText.trim();
    const warnings = queryElements(
      queryElement(meta, 'dd.warning.tags'),
      'a'
    ).map(a => a.innerText.trim());
    const relationships = queryElements(
      queryElement(meta, 'dd.relationship.tags'),
      'a'
    ).map(a => a.innerText.trim());
    const characters = queryElements(
      queryElement(meta, 'dd.character.tags'),
      'a'
    ).map(a => a.innerText.trim());
    const categories = queryElements(
      queryElement(meta, 'dd.category.tags'),
      'a'
    ).map(a => a.innerText.trim());
    const fandoms = queryElements(
      queryElement(meta, 'dd.fandom.tags'),
      'a'
    ).map(a => a.innerText.trim());
    const freeformTags = queryElements(
      queryElement(meta, 'dd.freeform.tags'),
      'a'
    )
      .map(a => a.innerText.trim())
      .filter(tag => tag.toLowerCase() !== 'podfic welcome'.toLowerCase());
    const language = queryElement(meta, 'dd.language').innerText.trim();

    const work = doc.getElementById('workskin');
    const title = queryElement(work, 'h2.title').innerText.trim();
    const authors = mapAuthors(
      queryElements(queryElement(work, '.byline'), 'a')
    );
    // The actual html of the summary, with <p>s replaced.
    const summary = sanitizeSummary(
      queryElement(queryElement(work, 'div.summary.module'), '.userstuff')
    );

    return {
      title,
      authors,
      rating,
      warnings,
      relationships,
      characters,
      categories,
      fandoms,
      freeformTags,
      language,
      summary,
    };
  }

  /**
   * Parse the data from a work page.
   * @param doc {Document}
   * @returns
   */
  function parseData(doc) {
    const work = doc.getElementById('workskin');
    // The actual html of the beginning notes, with <p>s replaced.
    const workBeginningNotes = sanitizeNotes(
      queryElement(queryElement(work, 'div.notes.module'), '.userstuff')
    );
    const workEndingNotes = sanitizeNotes(
      queryElement(queryElement(work, 'div.end.notes.module'), '.userstuff')
    );
    const chapters = doc.getElementById('chapters');

    return {
      workBeginningNotes,
      workEndingNotes,
      chapters,
    };
  }

  /**
   * Import the Ao3 work at this url.
   * @param {string} url
   */
  async function importAo3Work(url) {
    const html = await new Promise(resolve => {
      chrome.runtime.sendMessage({fetchUrl: url}, resolve);
    });

    const domParser = new DOMParser();
    let doc = domParser.parseFromString(html, 'text/html');

    return {
      result: 'success',
      // We return back the original URL so that storage only ever contains
      // the URL the user input instead of the one we used for fetching.
      metadata: {...parseGenMetadata(doc), url},
      data: {...parseData(doc), url},
    };
  }

  async function importAndFillNewChapter() {
    /** @type {InjectedScriptStorageData} */
    const {options} = /** @type {InjectedScriptStorageData} */ (
      await browser.storage.sync.get(['options'])
    );
    const importResult = await importAo3Work(options['url']);

    if (importResult.result === 'error') {
      // Tell the popup that the import failed and the reason why it failed.
      return importResult;
    }
    const data = importResult.data;
    const chapters = data['chapters'];
    var chapterList = chapters.children;

    let chapterNumber = 0;
    var chapterPosition = document.getElementById('chapter_position');
    if (chapterPosition != null) {
      chapterNumber = parseInt(chapterPosition.value);
    }
    if (chapterNumber == 0) {
      // We aren't adding a new chapter, so we don't need to do anything.
      return;
    }
    if (chapterList.length < chapterNumber) {
      // No importable chapter exists
      return;
    }
    var chapter = chapterList[chapterNumber - 1];

    const newChapterPage = document.getElementById('main');
    var workText = /** @type {HTMLInputElement} */ (
      queryElement(newChapterPage, '.mce-editor')
    );

    const chapterSummaryTextArea = /** @type {HTMLTextAreaElement} */ (
      queryElement(newChapterPage, '#chapter_summary')
    );
    var chapterSummaryModule = chapter.getElementsByClassName('summary');
    if (chapterSummaryModule.length > 0) {
      var chapterSummary =
        chapterSummaryModule[0].getElementsByClassName('userstuff');
      if (chapterSummary.length > 0) {
        chapterSummaryTextArea.value = chapterSummary[0].innerHTML;
      }
    }

    var chapterNotesSections = chapter.getElementsByClassName('notes');
    if (chapterNotesSections.length > 0) {
      // We have a beginning chapter notes section
      var startChapterNote = chapterNotesSections[0];
      if (startChapterNote.getElementsByClassName('userstuff').length > 0) {
        var chapterPreface =
          startChapterNote.getElementsByClassName('userstuff')[0].innerHTML;
        const chapterBeginNotesCheckmark = /** @type {HTMLInputElement} */ (
          queryElement(newChapterPage, '#front-notes-options-show')
        );
        if (!chapterBeginNotesCheckmark.checked) {
          chapterBeginNotesCheckmark.click();
        }
        const beginNotesTextArea = /** @type {HTMLTextAreaElement} */ (
          queryElement(newChapterPage, '#chapter_notes')
        );
        beginNotesTextArea.value = chapterPreface;
      }
    }
    if (chapterNotesSections.length > 1) {
      // We have an ending chapter notes section
      var endChapterNote = chapterNotesSections[1];
      if (endChapterNote.getElementsByClassName('userstuff').length > 0) {
        var chapterPostnote =
          endChapterNote.getElementsByClassName('userstuff')[0].innerHTML;
        const chapterEndingNotesCheckmark = /** @type {HTMLInputElement} */ (
          queryElement(newChapterPage, '#front-notes-options-show')
        );
        if (!chapterEndingNotesCheckmark.checked) {
          chapterEndingNotesCheckmark.click();
        }
        const endNotesTextArea = /** @type {HTMLTextAreaElement} */ (
          queryElement(newChapterPage, '#chapter_endnotes')
        );
        endNotesTextArea.value = chapterPostnote;
      }
    }
    var chapterText = chapter.querySelectorAll('[role="article"]');
    if (chapterText.length == 1) {
      workText.value = chapterText[0].innerHTML;
    }
  }

  async function importAndFillAo3Work() {
    let showPartialCompletionWarning = false;
    /** @type {InjectedScriptStorageData} */
    const {options, summary_template, title_template} =
      /** @type {InjectedScriptStorageData} */ (
        await browser.storage.sync.get([
          'options',
          'summary_template',
          'title_template',
          'notes_template',
        ])
      );

    const importResult = await importAo3Work(options['url']);

    if (importResult.result === 'error') {
      // Tell the popup that the import failed and the reason why it failed.
      return importResult;
    }
    const metadata = importResult.metadata;
    const data = importResult.data;
    const chapters = data['chapters'];

    const newWorkPage = document.getElementById('main');

    // Find the rating drop down, and pick the correct value.
    const ratingSelect = /** @type {HTMLSelectElement} */ (
      queryElement(newWorkPage, '#work_rating_string')
    );
    const ratingOptions = mapOptions(ratingSelect);
    ratingSelect.value = ratingOptions.get(metadata['rating']);

    // Find the warning check boxes, and check all the ones that apply.
    const warningBoxes = mapInputs(
      /** @type {HTMLInputElement[]} */ (
        queryElements(queryElement(newWorkPage, 'fieldset.warnings'), 'input')
      )
    );
    warningBoxes.set(
      'Creator Chose Not To Use Archive Warnings',
      warningBoxes.get('Choose Not To Use Archive Warnings')
    );
    // Somehow it is possible for the imported metadata to have different
    // warnings than new work form. In this case we just ignore the warning
    // we failed to map.
    for (const warning of metadata['warnings']) {
      if (warningBoxes.has(warning)) {
        warningBoxes.get(warning).checked = true;
      } else {
        showPartialCompletionWarning = true;
      }
    }

    // Find the fandom text input, and insert a comma-separated list of
    // fandoms. Tell ao3 we did so.
    const fandomInput = /** @type {HTMLInputElement} */ (
      queryElement(queryElement(newWorkPage, 'dd.fandom'), 'input')
    );
    setTagsInputValue(fandomInput, metadata['fandoms'].join(', '));

    // Find the category check boxes, and check all the ones that apply.
    const categoryBoxes = mapInputs(
      /** @type {HTMLInputElement[]} */ (
        queryElements(queryElement(newWorkPage, 'dd.category'), 'input')
      )
    );
    // Somehow it is possible for the imported metadata to have different
    // categories than new work form. In this case we just ignore the warning
    // we failed to map.
    for (const category of metadata['categories']) {
      if (categoryBoxes.has(category)) {
        categoryBoxes.get(category).checked = true;
      } else {
        showPartialCompletionWarning = true;
      }
    }

    // Find the relationship text input, and insert a comma-separated list
    // of relationships. Tell ao3 we did so.
    const relationshipInput = /** @type {HTMLInputElement} */ (
      queryElement(queryElement(newWorkPage, 'dd.relationship'), 'input')
    );
    setTagsInputValue(relationshipInput, metadata['relationships'].join(', '));

    // Find the character input, and insert a comma-separated list of
    // characters. Tell ao3 we did so.
    const characterInput = /** @type {HTMLInputElement} */ (
      queryElement(queryElement(newWorkPage, 'dd.character'), 'input')
    );
    setTagsInputValue(characterInput, metadata['characters'].join(', '));

    // Find the freeform tags input, and insert a comma-separated list of
    // freeform tags. (potentially auto-adding "Cross-Posted from AO3" tags)
    // Tell ao3 we did so.
    const additionalTagsInput = /** @type {HTMLInputElement} */ (
      queryElement(queryElement(newWorkPage, 'dd.freeform'), 'input')
    );
    if (options['ao3_crosspost_label']) {
      metadata['freeformTags'].push('Cross-Posted from AO3');
    }
    setTagsInputValue(additionalTagsInput, metadata['freeformTags'].join(', '));

    // Set the title.
    const titleInput = /** @type {HTMLInputElement} */ (
      queryElement(queryElement(newWorkPage, 'dd.title'), 'input')
    );
    const titleTemplate = getTitleTemplate(
      options['title_format'],
      title_template['default']
    );
    titleInput.value = transformTitle(
      titleTemplate,
      metadata['title'],
      new Map(metadata['authors'])
    );

    // Set the summary, optionally wrapping it in a block quote.
    const summaryTextArea = /** @type {HTMLTextAreaElement} */ (
      queryElement(queryElement(newWorkPage, 'dd.summary'), 'textarea')
    );
    const summaryTemplate = getSummaryTemplate(
      options['summary_format'],
      summary_template['default']
    );
    const authorMap = new Map(metadata['authors']);
    summaryTextArea.value = transformHtmlTemplate(
      summaryTemplate,
      metadata['summary'],
      metadata['title'],
      metadata['url'],
      authorMap
    );

    if (data['workBeginningNotes']) {
      const beginNotesCheckmark = /** @type {HTMLInputElement} */ (
        queryElement(newWorkPage, '#front-notes-options-show')
      );
      if (!beginNotesCheckmark.checked) {
        beginNotesCheckmark.click();
      }
      const beginNotesTextArea = /** @type {HTMLTextAreaElement} */ (
        queryElement(newWorkPage, '#work_notes')
      );
      beginNotesTextArea.value = data['workBeginningNotes'];
    }
    if (data['workEndingNotes']) {
      const endNotesCheckmark = /** @type {HTMLInputElement} */ (
        queryElement(newWorkPage, '#end-notes-options-show')
      );
      if (!endNotesCheckmark.checked) {
        endNotesCheckmark.click();
      }
      const endNotesTextArea = /** @type {HTMLTextAreaElement} */ (
        queryElement(newWorkPage, '#work_endnotes')
      );
      endNotesTextArea.value = data['workEndingNotes'];
    }

    // Set the same language as the original work.
    const languageSelect = /** @type {HTMLSelectElement} */ (
      queryElement(newWorkPage, '#work_language_id')
    );
    const languageOptions = mapOptions(languageSelect);
    languageSelect.value = languageOptions.get(metadata['language']);

    // Set the new work text.
    var workText = /** @type {HTMLInputElement} */ (
      queryElement(newWorkPage, '.mce-editor')
    );
    // If there's nothing here yet, over-write it.
    if (workText.value == '') {
      if (chapters.getElementsByClassName('chapter').length == 0) {
        if (chapters.getElementsByClassName('userstuff') == 0) {
          console.log('No chapters found');
        } else {
          // We have ourselves a one shot
          var oneshot = chapters.getElementsByClassName('userstuff')[0];
          workText.value = oneshot.innerHTML;
        }
      } else {
        console.log('multi chapter found');
        // We have ourselves a multi-chapter fic
        var chapterList = chapters.children;
        var firstChapter = chapterList[0];
        var chapterNotesSections =
          firstChapter.getElementsByClassName('preface');
        if (chapterNotesSections.length > 0) {
          // We have a beginning chapter notes section
          var prefaceGroup = chapterNotesSections[0];
          if (prefaceGroup.getElementsByClassName('userstuff').length > 0) {
            var chapterPreface =
              prefaceGroup.getElementsByClassName('userstuff')[0].innerHTML;
            const chapterBeginNotesCheckmark = /** @type {HTMLInputElement} */ (
              queryElement(newWorkPage, '#front-notes-options-show')
            );
            if (!chapterBeginNotesCheckmark.checked) {
              chapterBeginNotesCheckmark.click();
            }
            const beginNotesTextArea = /** @type {HTMLTextAreaElement} */ (
              queryElement(newWorkPage, '#work_notes')
            );
            beginNotesTextArea.value = chapterPreface;
          }
        }
        if (chapterNotesSections.length > 1) {
          // We have an ending chapter notes section
          prefaceGroup = chapterNotesSections[1];
          if (prefaceGroup.getElementsByClassName('userstuff').length > 0) {
            var chapterPostnote =
              prefaceGroup.getElementsByClassName('userstuff')[0].innerHTML;
            const chapterEndingNotesCheckmark =
              /** @type {HTMLInputElement} */ (
                queryElement(newWorkPage, '#front-notes-options-show')
              );
            if (!chapterEndingNotesCheckmark.checked) {
              chapterEndingNotesCheckmark.click();
            }
            const endNotesTextArea = /** @type {HTMLTextAreaElement} */ (
              queryElement(newWorkPage, '#work_notes')
            );
            endNotesTextArea.value = chapterPostnote;
          }
        }
        var chapterText = firstChapter.querySelectorAll('[role="article"]');
        if (chapterText.length == 1) {
          workText.value = chapterText[0].innerHTML;
        }
      }
    }

    if (showPartialCompletionWarning) {
      return {
        result: 'error',
        message:
          'Warning: some data could not be imported, the most likely reason' +
          'is that you set your AO3 preferences to hide warnings or tags',
      };
    } else {
      // Tell the popup that the import worked as expected.
      return {
        result: 'success',
      };
    }
  }

  const ADD_CHAPTER_URL_PATTERNS = [
    /https:\/\/squidgeworld.org\/works\/[0-9]+\/chapters\/new/,
    /https:\/\/squidgeworld.org\/works\/[0-9]+\/chapters\/[0-9]+\/edit/,
    /https:\/\/archiveofourown.org\/works\/[0-9]+\/chapters\/new/,
    /https:\/\/archiveofourown.org\/works\/[0-9]+\/chapters\/[0-9]+\/edit/,
  ];
  // A cheap way to get a general unhandled error listener.
  try {
    const currentTab = window.location.href;
    // If we are on a page that is adding a new chapter
    if (
      ADD_CHAPTER_URL_PATTERNS.some(
        addChapterUrlPattern => currentTab.match(addChapterUrlPattern) !== null
      )
    ) {
      await importAndFillNewChapter();
    } else {
      await importAndFillAo3Work();
    }
  } catch (e) {
    let debugMessage;
    if (e instanceof Error) {
      debugMessage = `${e.message}: ${e.stack}`;
    } else {
      // Not much we can do here besides just try to coerce this to a string.
      debugMessage = `${e}`;
    }
    return {
      result: 'error',
      message: `Unhandled error while importing metadata and filling in the form: ${debugMessage}`,
    };
  }
  return {
    result: 'success',
  };
})();
