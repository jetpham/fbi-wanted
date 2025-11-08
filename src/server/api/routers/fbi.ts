import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const FBI_API_BASE_URL = "https://api.fbi.gov";

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
      
      const firstPageController = new AbortController();
      const firstPageTimeoutId = setTimeout(() => firstPageController.abort(), 30000);

      let firstPageResponse: Response;
      try {
        firstPageResponse = await fetch(firstPageUrl, {
          method: "GET",
          headers: { "Accept": "application/json" },
          signal: firstPageController.signal,
        });
        clearTimeout(firstPageTimeoutId);
      } catch (error) {
        clearTimeout(firstPageTimeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("FBI API request timed out");
        }
        throw error;
      }

      if (!firstPageResponse.ok) {
        throw new Error(
          `FBI API error: ${firstPageResponse.status} ${firstPageResponse.statusText}`,
        );
      }

      let firstPageData: WantedResultSet;
      try {
        firstPageData = (await firstPageResponse.json()) as WantedResultSet;
      } catch {
        throw new Error("Failed to parse FBI API response");
      }

      // Calculate total pages needed
      const totalPages = Math.ceil((firstPageData.total ?? 0) / pageSize);

      // Limit parallel requests to avoid overwhelming the API
      // Process pages in batches of 5 to be respectful to the API
      const BATCH_SIZE = 5;
      const remainingPages: WantedResultSet[] = [];

      for (let batchStart = 1; batchStart < totalPages; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalPages);
        const batch = await Promise.all(
          Array.from({ length: batchEnd - batchStart }, (_, i) => {
            const pageNum = batchStart + i + 1;
            const pageParams = new URLSearchParams({
              ...baseParams,
              page: String(pageNum),
            });
            const url = `${FBI_API_BASE_URL}/@wanted?${pageParams.toString()}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            return fetch(url, {
              method: "GET",
              headers: { "Accept": "application/json" },
              signal: controller.signal,
            })
              .then((res) => {
                clearTimeout(timeoutId);
                if (!res.ok) {
                  throw new Error(`FBI API error: ${res.status} ${res.statusText}`);
                }
                return res.json() as Promise<WantedResultSet>;
              })
              .catch((error) => {
                clearTimeout(timeoutId);
                if (error instanceof Error && error.name === "AbortError") {
                  throw new Error(`FBI API request timed out for page ${pageNum}`);
                }
                throw error;
              });
          }),
        );
        remainingPages.push(...batch);
      }

      // Combine all items from all pages
      const allItems = [
        ...(firstPageData.items ?? []),
        ...remainingPages.flatMap((pageResponse) => pageResponse.items ?? []),
      ];

      // Verify we got all pages (sanity check)
      if (allItems.length < (firstPageData.total ?? 0)) {
        // Log warning if we didn't get all items (but continue with what we have)
        console.warn(
          `Warning: Expected ${firstPageData.total} items but only received ${allItems.length}`,
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

