require([
  'gitbook',
  'jquery'
], function (gitbook, $) {
  function ElasticsearchEngine(config) {
    this.name = 'ElasticsearchEngine';
    this.config = config.elasticsearch
    this.timeout = null
    this.abortController = null
  }

  ElasticsearchEngine.prototype.init = function () {
    return Promise.resolve()
  };

  ElasticsearchEngine.prototype.search = function (q, offset, length) {
    var headers = {
      Accept: "application/json",
      "Content-Type": "application/json"
    }
    if (this.config.apiKey) {
      headers["Authorization"] = "ApiKey " + this.config.apiKey
    }
    var maxResults = 20
    if (this.config.maxResults) {
      maxResults = this.config.maxResults
    }

    // Cancel any in-flight request from a previous keystroke so that only the
    // result for the latest query reaches the UI.
    if (this.abortController) {
      this.abortController.abort()
    }
    var controller = new AbortController()
    this.abortController = controller

    var self = this
    return $.Deferred(function (defer) {
      clearTimeout(self.timeout);
      self.timeout = setTimeout(function () {
        fetch(self.config.host + "/" + self.config.index + "/_search", {
          headers: headers,
          mode: "cors",
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({
            "query": {
              "simple_query_string": {
                "fields": ["title", "keywords", "body"],
                "query": q,
                "default_operator": "and"
              },
            },
            "highlight": {
              "fields": {
                "body": {}
              }
            },
            "size": maxResults
          })
        })
        .then(function (response) {
          if (!response.ok) {
            console.error("Request failed: [" + response.status + "] " + response.statusText)
            defer.reject("[" + response.status + "] " + response.statusText)
            return Promise.reject("[" + response.status + "] " + response.statusText);
          }
          return Promise.resolve(response);
        })
        .then(function (response) { return response.json() })
        .then(function (data) {
          return data.hits.hits.map(function (item) {
            var body = ""
            if (item.highlight != null) {
              item.highlight.body.forEach(function (b) {
                body += '<p>' + b + '</p>\n'
              })
            } else {
              body = item._source.body.substr(0, 100)
            }

            return {
              title: item._source.title,
              url: item._source.url,
              body: body
            };
          })
        })
        .then(function (results) {
          // A newer query has superseded this one; drop the result silently to
          // avoid clobbering the UI with stale data.
          if (controller.signal.aborted) {
            defer.resolve({ query: q, results: [], count: 0 })
            return
          }
          defer.resolve({
            query: q,
            results: results.slice(0, length),
            count: results.length
          })
        })
        .catch(function (err) {
          // Aborted requests should not surface as errors to the UI.
          if (err && err.name === 'AbortError') {
            defer.resolve({ query: q, results: [], count: 0 })
            return
          }
          if (defer.state() === 'pending') {
            defer.reject(err)
          }
        })
      }, 100);
    }).promise();
  };

  gitbook.events.bind('start', function (e, config) {
    var engine = gitbook.search.getEngine();
    if (!engine) {
      gitbook.search.setEngine(ElasticsearchEngine, config);
    }
  });
});
