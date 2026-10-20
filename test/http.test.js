import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fetchWithRetry } from "../src/http.js";

async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("a transient server failure is retried once and a credential failure is never retried", async (t) => {
  let transientRequests = 0;
  let credentialRequests = 0;
  const url = await serve(t, (request, response) => {
    if (request.url === "/credentials") {
      credentialRequests += 1;
      response.writeHead(401).end("unauthorized");
    } else {
      transientRequests += 1;
      response.writeHead(transientRequests === 1 ? 503 : 200).end("result");
    }
  });
  assert.equal((await fetchWithRetry(url)).status, 200);
  assert.equal(transientRequests, 2);
  assert.equal((await fetchWithRetry(`${url}/credentials`)).status, 401);
  assert.equal(credentialRequests, 1);
});

test("a real unresponsive HTTP source times out after the bounded retry", async (t) => {
  let requests = 0;
  const url = await serve(t, () => { requests += 1; });
  await assert.rejects(fetchWithRetry(url, {}, { timeoutMs: 40 }), { name: "TimeoutError" });
  assert.equal(requests, 2);
});
