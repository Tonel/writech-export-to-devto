const turndown = require("turndown");
const turndownPluginGfm = require("turndown-plugin-gfm");
const cheerio = require("cheerio");

function initTurndownService() {
  const turndownService = new turndown({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  turndownService.use(turndownPluginGfm.tables);

  // preserve embedded tweets
  turndownService.addRule("tweet", {
    filter: (node) =>
      node.nodeName === "BLOCKQUOTE" &&
      node.getAttribute("class") === "twitter-tweet",
    replacement: (content, node) => "\n\n" + node.outerHTML,
  });

  // preserve embedded codepens
  turndownService.addRule("codepen", {
    filter: (node) => {
      // codepen embed snippets have changed over the years
      // but this series of checks should find the commonalities
      return (
        ["P", "DIV"].includes(node.nodeName) &&
        node.attributes["data-slug-hash"] &&
        node.getAttribute("class") === "codepen"
      );
    },
    replacement: (content, node) => "\n\n" + node.outerHTML,
  });

  // preserve embedded scripts (for tweets, codepens, gists, etc.)
  turndownService.addRule("script", {
    filter: "script",
    replacement: (content, node) => {
      let before = "\n\n";
      if (node.previousSibling && node.previousSibling.nodeName !== "#text") {
        // keep twitter and codepen <script> tags snug with the element above them
        before = "\n";
      }
      const html = node.outerHTML.replace('async=""', "async");
      return before + html + "\n\n";
    },
  });

  // preserve iframes (common for embedded audio/video)
  turndownService.addRule("iframe", {
    filter: "iframe",
    replacement: (content, node) => {
      const html = node.outerHTML.replace(
        'allowfullscreen=""',
        "allowfullscreen"
      );
      return "\n\n" + html + "\n\n";
    },
  });

  // Add a custom rule for code blocks with language
  turndownService.addRule("codeWithLanguage", {
    filter: "pre",
    replacement: function (content, node) {
      const className = node.className;

      if (className && className.startsWith("wp-block-code")) {
        const languageMatch = className.match(/language-(\S+)/);
        const language = languageMatch ? languageMatch[1] : "";
        return "```" + language + "\n" + content + "\n```";
      }

      return "\n" + content + "\n";
    },
  });

  return turndownService;
}

function preProcessing(content) {
  content = content.replace(/’/g, "'");
  content = content.replace(/“/g, '"');
  content = content.replace(/”/g, '"');
  content = content.replace(/&nbsp;/g, " ");

  const $ = cheerio.load(content, { xmlMode: true });

  const codeStrongElements = $("code > strong");
  if (codeStrongElements.length > 0) {
    codeStrongElements.toArray().forEach((strong) => {
      $(strong).html(`<code>${$(strong).text()}</code>`);
      const strongHtml = $(strong).prop("outerHTML");
      const code = $(strong).parent();
      $(code).replaceWith(`${strongHtml}`);
    });
  }

  const codeLinkElements = $("code > a");
  if (codeLinkElements.length > 0) {
    codeLinkElements.toArray().forEach((a) => {
      $(a).html(`<code>${$(a).text()}</code>`);
      const aHtml = $(a).prop("outerHTML");
      const code = $(a).parent();
      $(code).replaceWith(`${aHtml}`);
    });
  }

  const images = $("img");
  images.toArray().forEach((image) => {
    const src = $(image).attr("src");
    // regex pattern to remove "-YYYxZZZ" or any similar pattern before the file extension
    const regexPattern = /-\d+x\d+(?=\.png|\.jpg|\.jpeg|\.gif|\.bmp|\.svg)/;

    // replace the matched pattern with an empty string
    const hqSrc = src.replace(regexPattern, "");
    $(image).attr("src", hqSrc);
  });

  const codeElements = $(".wp-block-codemirror-blocks-code-block.code-block");
  if (codeElements.length > 0) {
    codeElements.toArray().forEach((code) => {
      const html = $.html();
      const indexCodeText = html.indexOf($(code).prop("outerHTML"));
      const codeComment = html.substring(indexCodeText - 95, indexCodeText);

      let language = "javascript";
      if (codeComment.includes("html")) {
        language = "html";
      } else if (codeComment.includes("kotlin")) {
        language = "kotlin";
      } else if (codeComment.includes("x-java")) {
        language = "java";
      } else if (codeComment.includes("php")) {
        language = "php";
      } else if (codeComment.includes("text/plain")) {
        language = null;
      } else if (codeComment.includes("shell")) {
        language = "shell";
      } else if (codeComment.includes("application/json")) {
        language = "json";
      } else if (codeComment.includes("xml")) {
        language = "xml";
      } else if (codeComment.includes("groovy")) {
        language = "groovy";
      } else if (codeComment.includes("sql")) {
        language = "sql";
      } else if (codeComment.includes("yaml")) {
        language = "yaml";
      } else if (codeComment.includes("powershell")) {
        language = "powershell";
      } else if (codeComment.includes("css")) {
        language = "css";
      }

      $(code).replaceWith(
        `<pre class="wp-block-code ${
          language ? `language-${language}` : ""
        }"><code>${$(code).find("pre").prop("innerHTML")}</code></pre>`
      );
    });
  }

  const hs = ["h1", "h2", "h3", "h4", "h5"];

  for (const h of hs) {
    const h3BoldElements = $(`${h}.wp-block-heading > strong`);
    if (h3BoldElements.length > 0) {
      h3BoldElements.toArray().forEach((strong) => {
        const title = $(strong).prop("innerHTML");
        $(strong).parent().html(title);
      });
    }
  }

  $("figcaption").remove();

  return $.html();
}

function getPostContent(post, turndownService) {
  let content = preProcessing(post.encoded[0]);

  // insert an empty div element between double line breaks
  // this nifty trick causes turndown to keep adjacent paragraphs separated
  // without mucking up content inside of other elemnts (like <code> blocks)
  content = content.replace(/(\r?\n){2}/g, "\n<div></div>\n");

  // this is a hack to make <iframe> nodes non-empty by inserting a "." which
  // allows the iframe rule declared in initTurndownService() to take effect
  // (using turndown's blankRule() and keep() solution did not work for me)
  content = content.replace(/(<\/iframe>)/gi, ".$1");

  // use turndown to convert HTML to Markdown
  content = turndownService.turndown(content);

  // clean up extra spaces in list items
  content = content.replace(/(-|\d+\.) +/g, "$1 ");

  // clean up the "." from the iframe hack above
  content = content.replace(/\.(<\/iframe>)/gi, "$1");

  content += `
  \n***\n_The post "[${post.title}](${post.link[0]})" appeared first on [Writech](https://writech.run)._`;

  return content;
}

exports.initTurndownService = initTurndownService;
exports.getPostContent = getPostContent;
