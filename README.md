# AO3 Cross Posting Helper

## Fork of this project: [ao3-podfic-posting-helper](https://github.com/LazyCats-dev/ao3-podfic-posting-helper)

We'd like to acknowledge [ao3-podfic-posting-helper](https://github.com/LazyCats-dev/ao3-podfic-posting-helper) for giving a great foundation for us to build additional functionality. Please check out that action if you think it better suits your needs.

# AO3 Cross Posting Helper

![Logo: A AO3 icon with a decentralized icon in the O](images/icon-225.png?raw=true)

This extension can help you crosspost a new work in between Ao3 and Ao3 clones such as Squidgeworld.

_This is an unofficial extension and not supported by AO3 or Squidgeworld_. Please do not raise issues with this extension to AO3 or Squidegworld support.

[Available on the Chrome Web Store](https://chromewebstore.google.com/detail/ao3-cross-posting-helper/pgijeejlbibgnpfmeljdbjckpdmcmche?hl=en)

[Available as a Firefox Add-on](https://addons.mozilla.org/en-US/firefox/addon/ao3-cross-posting-helper/)

You can configure it to:

- Automatically add the "Cross-Posted from AO3" tag
- Apply a transformation to the original title, such as adding the prefix "[Ao3 Crosspost] "
- Apply a transformation to the original summary, such as wrapping it in a blockquote and linking to the original work

![A popup over the new work page, showing the options available to configure importing metadata](images/pop-up-screen-shot.png)

If the default set of title transformations isn't enough, you can configure a custom format on the options page. "**\${title}**" will be replaced with the original title and "**\${authors}**" with the original authors.

For example, if the original work is called "Super awesome title" and is by
"author1" and "author2":

- "**\${title}**" will give you "Super awesome title"
- "[Cross-Posted from AO3] **\${title}**" will give you "[Cross-Posted from AO3] Super awesome title"
- "crosspost of **\${title}** by **\${authors}**"
  will give you "crosspost of Super awesome title by author1, author2"

![An options page where you can configure a custom title transformation](images/title-options-screen-shot.png)

If the default set of summary transformations isn't enough, you can configure a custom format on the options page. The following replacements will be made:

- **\${blocksummary}**: The summary of the original work wrapped in a blockquote. Because of the way ao3 handles block quotes, you should put whatever you want to follow this on the same line.
- **\${summary}**:The summary of the original work.
- **\${title}**: The title of the original work. This will be a link to the original work.
- **\${authors}**: A comma-separated list of the authors of the original work. Each author is a link to their AO3 page.

![An options page where you can configure a custom summary transformation](images/summary-options-screen-shot.png)

You can also configure a custom default body for your work, instead of a default which demonstrates how to embed audio, images, or links.

## Documentation

A lot of the basic structure of this app (popup page/option page/background loader) was built directly on the Chrome extension [getting started tutorial](https://developer.chrome.com/docs/extensions/mv3/getstarted/).

### popup.js

The core importing logic that gets the metadata from the original work, and the filling logic, to enter it into AO3's new work form. There's also some logic here to save pop-up options when a user hits import, so that they'll be the same next time.

### Storing options

The only way to pass information between the form fields in the pop-up and the injected html that fills in the "new work" form is to write it to storage and then read it back. That's what the `browser.storage.sync.set`/`get` calls do.

### Code design

The pop-up and options page are built using [Material Design Components for Web](https://material.io/). We are using the web components without a framework and with barebones CSS. The JS and CSS files for the components were downloaded from CDN and are packed in source here. We didn't set up any kind of package management with Node or any bundling with tools like Webpack on account of these being more effort than we were willing to invest right now. Code is organized as ES6 modules where possible.
