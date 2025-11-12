import { cacheLife } from "next/cache";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const FBI_API_BASE_URL = "https://api.fbi.gov";

// Exponential backoff configuration for 429 errors
const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 1000; // Start with 1 second

/**
 * Fetches a URL with exponential backoff retry for 429 errors
 * Returns null if all retries are exhausted
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES,
): Promise<WantedResultSet | null> {
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      // If we get a 429, retry with exponential backoff
      if (response.status === 429) {
        // Consume the response body to avoid memory leaks
        await response.text().catch(() => void 0);
        
        if (attempt < maxRetries) {
          const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `FBI API rate limited (429) for ${url}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        } else {
          // Max retries exhausted, give up on this page
          console.error(
            `FBI API rate limited (429) for ${url}, max retries exhausted. Skipping this page.`,
          );
          return null;
        }
      }
      
      // For other non-OK responses, throw error (don't retry)
      if (!response.ok) {
        // Consume the response body before throwing
        await response.text().catch(() => void 0);
        throw new Error(`FBI API error: ${response.status} ${response.statusText}`);
      }
      
      // Success - parse and return
      return (await response.json()) as WantedResultSet;
    } catch (error) {
      clearTimeout(timeoutId);
      controller.abort();
      
      // Handle timeout errors
      if (error instanceof Error && error.name === "AbortError") {
        // Don't retry timeouts, throw immediately
        throw new Error(`FBI API request timed out`);
      }
      
      // For non-429 errors, throw immediately (don't retry)
      if (error instanceof Error && !error.message.includes("429")) {
        throw error;
      }
      
      // This shouldn't happen since we handle 429 above, but just in case
      if (attempt < maxRetries) {
        const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `FBI API error for ${url}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }
      
      // Max retries exhausted
      console.error(
        `FBI API error for ${url}, max retries exhausted. Skipping this page.`,
      );
      return null;
    }
  }
  
  return null;
}

// Types based on FBI API OpenAPI spec
export interface WantedImage {
  caption: string | null;
  original: string | null;
  large: string | null;
  thumb: string | null;
}

export interface WantedPerson {
  pathId: string | null;
  uid: string | null;
  title: string | null;
  description: string | null;
  images: WantedImage[] | null;
  files: Array<{ url: string | null; name: string | null }> | null;
  warning_message: string | null;
  remarks: string | null;
  details: string | null;
  additional_information: string | null;
  caution: string | null;
  reward_text: string | null;
  reward_min: number | null;
  reward_max: number | null;
  dates_of_birth_used: string[] | null;
  place_of_birth: string | null;
  locations: string[] | null;
  field_offices: string[] | null;
  legat_names: string[] | null;
  status: string | null;
  person_classification: string | null;
  poster_classification: string | null;
  ncic: string | null;
  age_min: number | null;
  age_max: number | null;
  weight_min: number | null;
  weight_max: number | null;
  height_min: number | null;
  height_max: number | null;
  eyes: string | null;
  hair: string | null;
  build: string | null;
  sex: string | null;
  race: string | null;
  nationality: string | null;
  scars_and_marks: string | null;
  complexion: string | null;
  occupations: string[] | null;
  possible_countries: string[] | null;
  possible_states: string[] | null;
  modified: string | null;
  publication: string | null;
  path: string | null;
}

// Structure of what the FBI API returns per page request
// We use 'total' and 'items' internally, but 'page' is part of the API response
export interface WantedResultSet {
  total: number;
  page: number; // Current page number from FBI API response
  items: WantedPerson[];
}

export interface WantedPersonSummary {
  image: WantedImage;
  name: string;
  detailUrl: string;
}

export const fbiRouter = createTRPCRouter({
  /**
   * Get all wanted persons with images - fetches all pages and returns simplified array
   * Returns array of objects with imageUrl, name, and detailUrl
   */
  getAllWithImages: publicProcedure
    .input(
      z
        .object({
          poster_classification: z.string().nullable().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      "use cache";
      cacheLife("weeks"); // Cache for 1 week - FBI data updates weekly

      const pageSize = 50;
      const baseParams: Record<string, string> = {
        pageSize: String(pageSize),
        ...(input?.poster_classification && {
          poster_classification: input.poster_classification,
        }),
      };

      // Fetch first page to get total count
      const firstPageParams = new URLSearchParams({
        ...baseParams,
        page: "1",
      });
      const firstPageUrl = `${FBI_API_BASE_URL}/@wanted?${firstPageParams.toString()}`;
      
      const firstPageData = await fetchWithRetry(firstPageUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      // If first page fails completely, we can't proceed
      if (!firstPageData) {
        throw new Error(
          "FBI API error: Failed to fetch first page after retries (429 Too Many Requests)",
        );
      }

      // Calculate total pages needed
      const totalPages = Math.ceil((firstPageData.total ?? 0) / pageSize);

      // Limit parallel requests to avoid overwhelming the API
      // Process pages in batches of 5 to be respectful to the API
      const BATCH_SIZE = 5;
      const remainingPages: WantedResultSet[] = [];
      const failedPages: number[] = [];

      for (let batchStart = 1; batchStart < totalPages; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalPages);
        const batchPromises = Array.from({ length: batchEnd - batchStart }, (_, i) => {
          const pageNum = batchStart + i + 1;
          const pageParams = new URLSearchParams({
            ...baseParams,
            page: String(pageNum),
          });
          const url = `${FBI_API_BASE_URL}/@wanted?${pageParams.toString()}`;
          
          return fetchWithRetry(url, {
            method: "GET",
            headers: { "Accept": "application/json" },
          }).then((result) => ({
            pageNum,
            result,
          }));
        });

        // Use allSettled to handle failures gracefully
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            if (result.value.result) {
              remainingPages.push(result.value.result);
            } else {
              failedPages.push(result.value.pageNum);
            }
          } else {
            // Log the error but continue processing other pages
            console.error(`Failed to fetch page: ${result.reason}`);
          }
        }
      }

      // Log summary of failed pages if any
      if (failedPages.length > 0) {
        console.warn(
          `Failed to fetch ${failedPages.length} page(s) after retries: ${failedPages.join(", ")}. Continuing with available data.`,
        );
      }

      // Combine all items from all pages
      const allItems = [
        ...(firstPageData.items ?? []),
        ...remainingPages.flatMap((pageResponse) => pageResponse.items ?? []),
      ];

      // Verify we got all pages (sanity check)
      if (allItems.length < (firstPageData.total ?? 0)) {
        // Log warning if we didn't get all items (but continue with what we have)
        const missingCount = (firstPageData.total ?? 0) - allItems.length;
        console.warn(
          `Warning: Expected ${firstPageData.total} items but only received ${allItems.length} (missing ${missingCount} items${failedPages.length > 0 ? ` from ${failedPages.length} failed page(s)` : ""})`,
        );
      }

      // Filter and transform to simplified format
      const result: WantedPersonSummary[] = [];

      for (const person of allItems) {
        if (!person.images || person.images.length === 0) {
          continue;
        }

        const image = person.images[0];
        if (!image) {
          continue;
        }

        // Ensure original image URL exists (we only use original)
        if (!image.original) {
          continue;
        }

        const detailUrl = person.path
          ? `https://www.fbi.gov${person.path}`
          : person.pathId ?? "";

        if (!detailUrl) {
          continue;
        }

        result.push({
          image,
          name: person.title ?? "Unknown",
          detailUrl,
        });
      }

      return result;
    }),
});

