const fs = require("fs");
const luxon = require("luxon");
const xml2js = require("xml2js");

const settings = require("./settings");
const translator = require("./translator");

async function parseFilePromise() {
  console.log("Parsing export.xml...");
  const content = await fs.promises.readFile("export.xml", "utf8");
  const data = await xml2js.parseStringPromise(content, {
    trim: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });

  const posts = collectPosts(data, ["post"]);

  return posts;
}

function getItemsOfType(data, type) {
  return data.rss.channel[0].item.filter((item) => item.post_type[0] === type);
}

function collectPosts(data, postTypes) {
  // this is passed into getPostContent() for the markdown conversion
  const turndownService = translator.initTurndownService();

  let allPosts = [];
  postTypes.forEach((postType) => {
    const postsForType = getItemsOfType(data, postType)
      .filter(
        (post) => post.status[0] !== "trash" && post.status[0] !== "draft"
      )
      .map((post) => ({
        // meta data isn't written to file, but is used to help with other things
        meta: {
          id: getPostId(post),
          url: `https://writech.run/blog/${getPostSlug(post)}`,
          slug: getPostSlug(post),
          coverImageId: getPostCoverImageId(post),
          type: postType,
          imageUrls: [],
          title: getPostTitle(post),
          date: getPostDate(post),
          categories: getCategories(post),
          tags: getTags(post),
          cover_image: getCoverImage(post),
          canonical_url: getCanonicalUrl(post),
          description: getDescription(post),
          subtitle: getSubtitle(post),
        },
        content: translator.getPostContent(post, turndownService),
      }));

    if (postTypes.length > 1) {
      console.log(
        `${postsForType.length} "${postType}" posts found and parsed`
      );
    }

    allPosts.push(...postsForType);
  });

  return allPosts;
}

function getCanonicalUrl(post) {
  return post.link[0];
}

function getDescription(post) {
  let description = "";

  const postMetaDescription = post.postmeta.find(
    (p) =>
      p.meta_key &&
      p.meta_key.length > 0 &&
      p.meta_key[0] === "_yoast_wpseo_metadesc"
  );

  if (
    postMetaDescription &&
    postMetaDescription.meta_value &&
    postMetaDescription.meta_value.length > 0
  ) {
    description = postMetaDescription.meta_value[0];
  }

  return description;
}

function getSubtitle(post) {
  let subtitle = "";

  const postMetaSubtitle = post.postmeta.find(
    (p) =>
      p.meta_key &&
      p.meta_key.length > 0 &&
      p.meta_key[0] === "_yoast_wpseo_opengraph-description"
  );

  if (
    postMetaSubtitle &&
    postMetaSubtitle.meta_value &&
    postMetaSubtitle.meta_value.length > 0
  ) {
    subtitle = postMetaSubtitle.meta_value[0];
  }

  if (post.encoded && post.encoded.length > 1) {
    subtitle = post.encoded[1];
  }

  return subtitle;
}

function getCoverImage(post) {
  let coverImage = "";

  const postMetaCoverImage = post.postmeta.find(
    (p) =>
      p.meta_key &&
      p.meta_key.length > 0 &&
      p.meta_key[0] === "_yoast_wpseo_opengraph-image"
  );

  if (
    postMetaCoverImage &&
    postMetaCoverImage.meta_value &&
    postMetaCoverImage.meta_value.length > 0
  ) {
    coverImage = postMetaCoverImage.meta_value[0];
  }

  // regex pattern to remove "-YYYxZZZ" or any similar pattern before the file extension
  const regexPattern = /-\d+x\d+(?=\.png|\.jpg|\.jpeg|\.gif|\.bmp|\.svg)/;

  // replace the matched pattern with an empty string
  const hqCoverImage = coverImage.replace(regexPattern, "");

  return hqCoverImage;
}

function getPostId(post) {
  return post.post_id[0];
}

function getPostSlug(post) {
  return decodeURIComponent(post.post_name[0]);
}

function getPostCoverImageId(post) {
  if (post.postmeta === undefined) {
    return undefined;
  }

  const postmeta = post.postmeta.find(
    (postmeta) => postmeta.meta_key[0] === "_thumbnail_id"
  );
  const id = postmeta ? postmeta.meta_value[0] : undefined;
  return id;
}

function getPostTitle(post) {
  return post.title[0];
}

function getPostDate(post) {
  const dateTime = luxon.DateTime.fromRFC2822(post.pubDate[0], { zone: "utc" });

  return dateTime.toISO();
}

function getCategories(post) {
  const categories = processCategoryTags(post, "category");
  return categories.filter(
    (category) => !settings.filter_categories.includes(category)
  );
}

function getTags(post) {
  return processCategoryTags(post, "post_tag")
    .filter((t) => !t.includes("tutorial"))
    .filter((t) => !t.includes("guide"))
    .map((t) => t.replace(/" "/g, ""))
    .map((t) => t.replace(/-/g, ""))
    .slice(0, 4);
}

function processCategoryTags(post, domain) {
  if (!post.category) {
    return [];
  }

  return post.category
    .filter((category) => category.$.domain === domain)
    .map(({ $: attributes }) => decodeURIComponent(attributes.nicename));
}

exports.parseFilePromise = parseFilePromise;
