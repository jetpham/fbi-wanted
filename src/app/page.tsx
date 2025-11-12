import { Suspense } from "react";
import { api, HydrateClient } from "~/trpc/server";
import { WantedPersonCard } from "./_components/WantedPersonCard";

async function WantedPersonsList() {
  let wantedPersons;
  try {
    // Fetch all wanted persons with images - API handles all pagination
    wantedPersons = await api.fbi.getAllWithImages();
  } catch (error) {
    // Return error state if API call fails
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Failed to load wanted persons
          </h1>
          <p className="text-gray-600">
            {error instanceof Error ? error.message : "An unknown error occurred"}
          </p>
        </div>
      </div>
    );
  }

  if (wantedPersons.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-600 mb-4">
            No wanted persons found
          </h1>
          <p className="text-gray-500">
            There are currently no wanted persons with images available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16">
      {wantedPersons.map((person) => (
        <WantedPersonCard key={person.detailUrl} person={person} />
      ))}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-600 mb-4">
          Loading wanted persons...
        </h1>
        <p className="text-gray-500">Please wait while we fetch the data.</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <HydrateClient>
      <main>
        <Suspense fallback={<LoadingFallback />}>
          <WantedPersonsList />
        </Suspense>
      </main>
    </HydrateClient>
  );
}
