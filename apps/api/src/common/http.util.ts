import { BadGatewayException, NotFoundException } from "@nestjs/common";

/**
 * Fetch JSON from an upstream catalogue provider, mapping the HTTP-response
 * outcomes every provider handles the same way: a 404 → NotFound (only when a
 * `notFoundMessage` is given — some providers never return 404), any other
 * non-2xx → BadGateway.
 *
 * The parsed body is returned as `T`. Providers wrapping their payload in an
 * envelope (GraphQL's `{ data, errors }`) pass that envelope as `T` and handle
 * their own in-band errors on top.
 */
export async function fetchJson<T>(
  url: string | URL,
  init: RequestInit,
  opts: { sourceLabel: string; notFoundMessage?: string },
): Promise<T> {
  const response = await fetch(url, init);

  if (opts.notFoundMessage && response.status === 404) {
    throw new NotFoundException(opts.notFoundMessage);
  }

  if (!response.ok) {
    throw new BadGatewayException(
      `${opts.sourceLabel} request failed with status ${response.status}`,
    );
  }

  return (await response.json()) as T;
}
