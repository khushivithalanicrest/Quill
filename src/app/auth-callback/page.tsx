"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { trpc } from "../_trpc/client";

const Page = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const origin = searchParams.get("origin");
  console.log("Origin:", pathname);

  const query = trpc.authCallback.useQuery(undefined, {
    retry: true,
    retryDelay: 500,
  });

  // Check for errors in the query result
  if (query.error) {
    const errData = query.error.data;
    if (errData?.code === "UNAUTHORIZED") {
      router.push("/sign-in");
    } else {
      // Handle other types of errors
      console.error("An error occurred:", query.error);
    }
  }

  if (query.data?.success && pathname !== "/dashboard") {
    router.push(origin ? `/${origin}` : "/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Redirecting...</h1>
      <p>Please wait while we redirect you.</p>
    </div>
  );
};

export default Page;
