import { Button } from "@/components/ui/button";
import {
  AllFilters,
  ChainOptionsFilter,
  ChainServiceFilter,
  ChainTypeFilter,
} from "./components/client/filters";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { headers } from "next/headers";
import { SearchInput } from "./components/client/search";
import {
  ChainMetadataWithServices,
  ChainSupportedService,
} from "../types/chain";
import Fuse from "fuse.js";
import { THIRDWEB_API_HOST } from "constants/urls";
import { ChainlistPagination } from "./components/client/pagination";
import { ChainListRow } from "./components/server/chainlist-row";
import { StarButton } from "../components/client/star-button";
import { ChainListCard } from "./components/server/chainlist-card";
import { ChainListView } from "./components/client/view";
import { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "../../../../@/components/ui/Spinner/Spinner";

type SearchParams = Partial<{
  type: "mainnet" | "testnet";
  service: ChainSupportedService[] | ChainSupportedService;
  includeDeprecated: boolean;
  query: string;
  page: number;
  // maybe later we'll have a page size param?
  // pageSize: number;

  // table or grid style?
  view: "table" | "grid";
}>;

// 24 because it is cleanly divisible by 2,3 and 4 (for card grid)
const DEFAULT_PAGE_SIZE = 24;
const DEFAULT_PAGE = 1;

async function getChains() {
  const response = await fetch(
    `${THIRDWEB_API_HOST}/v1/chains?includeServices=true`,
    { next: { revalidate: 3600 } },
  );

  if (!response.ok) {
    response.body?.cancel();
    throw new Error("Failed to fetch chains");
  }
  return (await response.json()).data as ChainMetadataWithServices[];
}

async function getChainsToRender(params: SearchParams) {
  const chains = await getChains();

  // sort the chains
  const sortedChains = chains.sort((a, b) => {
    // sort by number of services first
    const aServices = a.services.filter((s) => s.enabled).length;
    const bServices = b.services.filter((s) => s.enabled).length;
    if (aServices > bServices) {
      return -1;
    }
    if (aServices < bServices) {
      return 1;
    }
    // if they have the same number of services, sort by chainId
    if (a.chainId > b.chainId) {
      return 1;
    }
    if (a.chainId < b.chainId) {
      return -1;
    }
    return 0;
  });

  const filteredChains: ChainMetadataWithServices[] = [];
  for (const chain of sortedChains) {
    // handle deprecated chains
    if (!params.includeDeprecated) {
      // if chain is deprecated, return false to filter it out
      if (chain.status === "deprecated") {
        // skip to the next chain
        continue;
      }
    }
    // handle testnet and mainnet filter cases (if )
    if (params.type) {
      // if the filter is testnet and the chain is not a testnet, return false to filter it out
      if (params.type === "testnet" && !chain.testnet) {
        // skip to the next chain
        continue;
      }
      // if the filter is mainnet and the chain is a testnet, return false to filter it out
      if (params.type === "mainnet" && chain.testnet) {
        // skip to the next chain
        continue;
      }
    }

    // handle services filter (if no filter set, all chains pass through here)
    if (params.service) {
      const urlServiceArray = Array.isArray(params.service)
        ? params.service
        : [params.service];
      // if the chain does not have all of the services in the filter, return false to filter it out
      if (
        !urlServiceArray.every((service) =>
          chain.services.find((s) => s.enabled && s.service === service),
        )
      ) {
        // skip to the next chain
        continue;
      }
    }

    // if we got here, push the chain to the filtered chains array
    filteredChains.push(chain);
  }

  if (params.query) {
    const fuse = new Fuse(filteredChains, {
      keys: [
        {
          name: "name",
          weight: 2,
        },
        {
          name: "chainId",
          weight: 1,
        },
      ],
      threshold: 0.2,
    });
    return fuse
      .search(params.query, {
        limit: DEFAULT_PAGE_SIZE,
      })
      .map((e) => e.item);
  }
  return filteredChains;
}

export const metadata: Metadata = {
  title: "Chainlist: RPCs, Block Explorers, Faucets",
  description:
    "A list of EVM networks with RPCs, smart contracts, block explorers & faucets. Deploy smart contracts to all EVM chains with thirdweb.",
};

export default function ChainListPage(props: { searchParams: SearchParams }) {
  const headersList = headers();
  const viewportWithHint = Number(
    headersList.get("Sec-Ch-Viewport-Width") || 0,
  );

  // default is driven by viewport hint
  const activeView = props.searchParams.view
    ? props.searchParams.view
    : viewportWithHint > 1000
      ? "table"
      : "grid";

  return (
    <section className="container mx-auto py-10 px-4 h-full flex flex-col">
      <header className="flex flex-col gap-4">
        <div className="flex gap-4 flex-col lg:flex-row lg:justify-between lg:items-center">
          <div className="flex gap-4 flex-row items-center justify-between lg:justify-start lg:flex-col">
            <h1 className="font-semibold text-4xl lg:text-5xl tracking-tighter">
              Chainlist
            </h1>
            <AddYourChainButton className="lg:hidden" />
          </div>
          <div className="flex flex-row lg:flex-col gap-4 items-end">
            <div className="flex flex-row gap-4 w-full">
              <SearchInput />
              <ChainListView activeView={activeView} />
              <AddYourChainButton className="hidden lg:flex" />
            </div>

            <div className="flex flex-row gap-2">
              <AllFilters />
              <div className="hidden lg:flex flex-row gap-2">
                <ChainTypeFilter />
                <ChainOptionsFilter />
                <ChainServiceFilter />
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="h-10"></div>
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <Spinner className="size-10" />
          </div>
        }
      >
        <ChainsData searchParams={props.searchParams} activeView={activeView} />
      </Suspense>
    </section>
  );
}

async function ChainsData(props: {
  searchParams: SearchParams;
  activeView: "table" | "grid";
}) {
  const chainsToRender = await getChainsToRender(props.searchParams);

  // pagination
  const totalPages = Math.ceil(chainsToRender.length / DEFAULT_PAGE_SIZE);

  const activePage = Number(props.searchParams.page || DEFAULT_PAGE);
  const pageSize = DEFAULT_PAGE_SIZE;
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedChains = chainsToRender.slice(startIndex, endIndex);

  return (
    <>
      {" "}
      <main>
        {/* empty state */}
        {paginatedChains.length === 0 ? (
          <div className="border p-8 h-[300px] lg:h-[500px] flex justify-center items-center rounded-lg">
            <p className="text-2xl">No Results found</p>
          </div>
        ) : props.activeView === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                <tr className="rounded-lg border-b">
                  {/* empty space for the icon */}
                  <th />
                  <TableHeading> Name </TableHeading>
                  <TableHeading> Chain ID </TableHeading>
                  <TableHeading> Native Token </TableHeading>
                  <TableHeading> Enabled Services </TableHeading>
                </tr>
                {paginatedChains.map((chain) => (
                  <ChainListRow
                    key={chain.chainId}
                    chainId={chain.chainId}
                    chainName={chain.name}
                    chainSlug={chain.slug}
                    currencySymbol={chain.nativeCurrency.symbol}
                    enabledServices={chain.services
                      .filter((c) => c.enabled)
                      .map((c) => c.service)}
                    isDeprecated={chain.status === "deprecated"}
                    favoriteButton={
                      <div className="relative h-6 w-6">
                        <StarButton
                          chainId={chain.chainId}
                          className="absolute z-10 top-0 h-full w-full left-0"
                        />
                      </div>
                    }
                    iconUrl={chain.icon?.url}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {paginatedChains.map((chain) => (
              <li key={chain.chainId} className="h-full">
                <ChainListCard
                  key={chain.chainId}
                  chainId={chain.chainId}
                  chainName={chain.name}
                  chainSlug={chain.slug}
                  currencySymbol={chain.nativeCurrency.symbol}
                  enabledServices={chain.services
                    .filter((c) => c.enabled)
                    .map((c) => c.service)}
                  isDeprecated={chain.status === "deprecated"}
                  favoriteButton={
                    <div className="relative h-6 w-6">
                      <StarButton
                        chainId={chain.chainId}
                        className="absolute z-10 top-0 h-full w-full left-0"
                      />
                    </div>
                  }
                  iconUrl={chain.icon?.url}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
      <div className="h-10"></div>
      {totalPages > 1 && (
        <ChainlistPagination totalPages={totalPages} activePage={activePage} />
      )}
    </>
  );
}

function TableHeading(props: { children: React.ReactNode }) {
  return (
    <th className="text-left p-4 font-medium text-muted-foreground min-w-[150px]">
      {props.children}
    </th>
  );
}

function AddYourChainButton(props: { className?: string }) {
  return (
    <Button asChild variant="default" className={props.className}>
      <Link
        href="https://support.thirdweb.com/how-to/vGcHXQ7tHXuSJf7jaL2y5Q/how-to-add-your-evm-chain-to-thirdweb%E2%80%99s-chainlist-/3HMqrwyxXUFxQYaudDJffT"
        target="_blank"
        className="flex items-center gap-2"
      >
        <PlusIcon className="size-4" />
        Add your chain
      </Link>
    </Button>
  );
}
