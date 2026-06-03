# honkit-plugin-elasticsearch

This plugin provides an Elasticsearch backend for [HonKit](https://github.com/honkit/honkit)'s built-in search plugin.

## Requirements

- HonKit >= 6
- Node.js >= 20

## Usage

HonKit ships with a built-in search plugin and the `lunr` indexer is enabled by default.
To use this plugin, disable `lunr` and add `elasticsearch` to your `book.json`:

```json
{
  "plugins": [
    "-lunr",
    "elasticsearch"
  ],
  "pluginsConfig": {
    "elasticsearch": {
      "host": "http://your-elasticsearch:9200",
      "index": "your-index",
      "apiKey": "your-apikey",
      "maxResults": 30
    }
  }
}
```

Install the plugin:

```sh
npm install --save-dev honkit honkit-plugin-elasticsearch
```

Building your book will generate `_book/search_index.json` in Elasticsearch `_bulk` format.
Insert it into your Elasticsearch cluster:

```sh
curl -XPOST "http://your-elasticsearch:9200/your-index/_bulk" \
  -H 'Content-Type: application/json' \
  --data-binary @_book/search_index.json
```

### Adding keywords to a page

You can specify explicit keywords for any page. When searching for these keywords, the page will rank higher in the results.

```md
---
search:
    keywords: ['keyword1', 'keyword2', 'etc.']

---

# My Page

This page will rank better if we search for 'keyword1'.
```

### Disabling indexing of a page

You can disable the indexing of a specific page by adding a YAML header to the page:

```md
---
search: false
---

# My Page

This page is not indexed in Elasticsearch.
```

