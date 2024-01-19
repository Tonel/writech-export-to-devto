/* eslint-disable no-undef */
const axios = require("axios");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getPublishedPosts() {
  const response = await axios.get("https://dev.to/api/articles", {
    params: {
      per_page: 1000,
      username: "antozanini",
    },
  });

  return response.data;
}

async function createDevToDrafts(posts) {
  const publishedPosts = await getPublishedPosts();

  const publishedPostCanonicalUrls = publishedPosts.map((p) => p.canonical_url);

  for (const post of posts) {
    if (!publishedPostCanonicalUrls.includes(post.meta.canonical_url)) {
      const devToCreationBody = {
        article: {
          title: post.meta.title,
          body_markdown: post.content,
          published: false,
          main_image: post.meta.cover_image,
          canonical_url: post.meta.canonical_url,
          description: post.meta.description,
          tags: post.meta.tags,
          organization_id: 8181,
        },
      };

      const devToApiKey = process.env.DEV_TO_API_KEY;
      await axios.post("https://dev.to/api/articles", devToCreationBody, {
        headers: {
          "api-key": devToApiKey,
          "user-agent": "insomnia/2023.5.8",
          "content-type": "application/json",
        },
      });

      // to avoid overloading the Dev.to server
      // with too many requests
      await sleep(1500);
    }
  }
}

exports.createDevToDrafts = createDevToDrafts;
