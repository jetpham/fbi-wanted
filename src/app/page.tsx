"use client";

import { useState, useEffect } from "react";
import { WantedPersonCard } from "./_components/WantedPersonCard";

const FBI_API_BASE_URL = "https://api.fbi.gov";

export default function Home() {
  const [wantedPersons, setWantedPersons] = useState<Array<{
    image: { caption: string | null; original: string | null; large: string | null; thumb: string | null };
    name: string;
    detailUrl: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllWantedPersons() {
      const pageSize = 50;
      const baseParams: Record<string, string> = {
        pageSize: String(pageSize),
      };

      try {
        // Fetch first page to get total count
        const firstPageParams = new URLSearchParams({
          ...baseParams,
          page: "1",
        });
        const firstPageUrl = `${FBI_API_BASE_URL}/@wanted?${firstPageParams.toString()}`;
        
        const firstPageResponse = await fetch(firstPageUrl, {
          method: "GET",
          headers: { "Accept": "application/json" },
        });

        // If we get a 429, stop immediately
        if (firstPageResponse.status === 429) {
          setError("Rate limited by FBI API. Please try again later.");
          setLoading(false);
          return;
        }

        if (!firstPageResponse.ok) {
          throw new Error(`FBI API error: ${firstPageResponse.status} ${firstPageResponse.statusText}`);
        }

        const firstPageData = (await firstPageResponse.json()) as {
          total: number;
          page: number;
          items: Array<{
            pathId: string | null;
            uid: string | null;
            title: string | null;
            description: string | null;
            images: Array<{ caption: string | null; original: string | null; large: string | null; thumb: string | null }> | null;
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
          }>;
        };

        // Calculate total pages needed
        const totalPages = Math.ceil((firstPageData.total ?? 0) / pageSize);

        // Limit parallel requests to avoid overwhelming the API
        const BATCH_SIZE = 5;
        const allItems = [...(firstPageData.items ?? [])];
        let rateLimited = false;

        // Fetch remaining pages in batches
        for (let batchStart = 1; batchStart < totalPages && !rateLimited; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, totalPages);
          const batchPromises = Array.from({ length: batchEnd - batchStart }, (_, i) => {
            const pageNum = batchStart + i + 1;
            const pageParams = new URLSearchParams({
              ...baseParams,
              page: String(pageNum),
            });
            const url = `${FBI_API_BASE_URL}/@wanted?${pageParams.toString()}`;
            
            return fetch(url, {
              method: "GET",
              headers: { "Accept": "application/json" },
            }).then(async (response) => {
              // If we get a 429, mark as rate limited and return null
              if (response.status === 429) {
                rateLimited = true;
                return null;
              }

              if (!response.ok) {
                throw new Error(`FBI API error: ${response.status} ${response.statusText}`);
              }

              const data = (await response.json()) as {
                total: number;
                page: number;
                items: Array<{
                  pathId: string | null;
                  uid: string | null;
                  title: string | null;
                  description: string | null;
                  images: Array<{ caption: string | null; original: string | null; large: string | null; thumb: string | null }> | null;
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
                }>;
              };
              return data;
            });
          });

          const batchResults = await Promise.allSettled(batchPromises);
          
          for (const result of batchResults) {
            if (result.status === "fulfilled" && result.value) {
              allItems.push(...(result.value.items ?? []));
            } else if (result.status === "fulfilled" && result.value === null) {
              // Rate limited, stop fetching
              rateLimited = true;
              break;
            }
          }

          // If rate limited, stop the outer loop
          if (rateLimited) {
            break;
          }
        }

        // Filter and transform to simplified format
        const result: Array<{
          image: { caption: string | null; original: string | null; large: string | null; thumb: string | null };
          name: string;
          detailUrl: string;
        }> = [];

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

        setWantedPersons(result);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch wanted persons");
        setLoading(false);
      }
    }

    fetchAllWantedPersons();
  }, []);

  if (loading) {
    return (
      <main>
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-600 mb-4">
              Loading wanted persons...
            </h1>
            <p className="text-gray-500">Please wait while we fetch the data.</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Error loading wanted persons
            </h1>
            <p className="text-gray-500">{error}</p>
            {wantedPersons.length > 0 && (
              <p className="text-gray-400 mt-2">
                Showing {wantedPersons.length} persons loaded before error.
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16">
        {wantedPersons.map((person) => (
          <WantedPersonCard key={person.detailUrl} person={person} />
        ))}
      </div>
    </main>
  );
}
