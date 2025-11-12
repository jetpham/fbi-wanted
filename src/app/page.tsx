"use client";

import { useState, useEffect } from "react";
import { WantedPersonCard } from "./_components/WantedPersonCard";

const FBI_API_BASE_URL = "https://api.fbi.gov";

type PersonItem = {
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
};

type ApiResponse = {
  total: number;
  page: number;
  items: PersonItem[];
};

// Helper function to transform person items to display format
function transformPerson(person: PersonItem): {
  image: { caption: string | null; original: string | null; large: string | null; thumb: string | null };
  name: string;
  detailUrl: string;
} | null {
  if (!person.images || person.images.length === 0) {
    return null;
  }

  const image = person.images[0];
  if (!image || !image.original) {
    return null;
  }

  const detailUrl = person.path
    ? `https://www.fbi.gov${person.path}`
    : person.pathId ?? "";

  if (!detailUrl) {
    return null;
  }

  return {
    image,
    name: person.title ?? "Unknown",
    detailUrl,
  };
}

// Maximum page size supported by FBI API (tested and confirmed: 50 is the max)
const MAX_PAGE_SIZE = 50;

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
      try {
        const baseParams: Record<string, string> = {
          pageSize: String(MAX_PAGE_SIZE),
        };

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

        const firstPageData = (await firstPageResponse.json()) as ApiResponse;

        // Stream the first page immediately
        const firstPageTransformed = (firstPageData.items ?? [])
          .map(transformPerson)
          .filter((p): p is NonNullable<typeof p> => p !== null);
        
        setWantedPersons(firstPageTransformed);

        // Calculate total pages needed
        const totalPages = Math.ceil((firstPageData.total ?? 0) / MAX_PAGE_SIZE);

        // Fetch remaining pages sequentially to stream results
        for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
          const pageParams = new URLSearchParams({
            ...baseParams,
            page: String(pageNum),
          });
          const url = `${FBI_API_BASE_URL}/@wanted?${pageParams.toString()}`;
          
          const response = await fetch(url, {
            method: "GET",
            headers: { "Accept": "application/json" },
          });

          // If we get a 429, stop fetching but keep what we have
          if (response.status === 429) {
            setError("Rate limited by FBI API. Showing partial results.");
            setLoading(false);
            return;
          }

          if (!response.ok) {
            throw new Error(`FBI API error: ${response.status} ${response.statusText}`);
          }

          const data = (await response.json()) as ApiResponse;
          
          // Transform and add new persons as they arrive
          const newPersons = (data.items ?? [])
            .map(transformPerson)
            .filter((p): p is NonNullable<typeof p> => p !== null);
          
          // Append new persons to existing list
          setWantedPersons((prev) => [...prev, ...newPersons]);
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch wanted persons");
        setLoading(false);
      }
    }

    fetchAllWantedPersons();
  }, []);

  return (
    <main>
      {/* Show error banner if error but we have some results */}
      {error && wantedPersons.length > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="max-w-7xl mx-auto text-sm text-yellow-800">
            {error} Showing {wantedPersons.length} persons loaded so far.
          </div>
        </div>
      )}

      {/* Grid of wanted persons */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16">
        {wantedPersons.map((person) => (
          <WantedPersonCard key={person.detailUrl} person={person} />
        ))}
      </div>
    </main>
  );
}
